import type { NfeValidation } from '../types/validation.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { AppConfig } from '../types/config.ts';
import { getCenarios } from './cenarios.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { bcIntegral } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { deriveCargaEfetiva, calcularICMSRecolherItem, calcularFundosItem } from './calculoHelpers.ts';

export interface ReconciliacaoTTD {
  refTTD: string;
  cenarios: string[];
  descricao: string;
  totalBC: number;
  totalICMSDestacado: number;
  cargaEfetiva: number;
  totalICMSRecolher: number;
  totalFundos: number;
  totalRecolherComFundos: number;
  /** Alternativa CAMEX 2,1% — valido apenas para linhas com itens CAMEX */
  totalICMSRecolher21: number;
  totalRecolherComFundos21: number;
  temCAMEX: boolean;
  qtdItens: number;
  qtdNfes: number;
  temDivergencia: boolean;
}

export interface ReconciliacaoCP {
  codigoCP: string;
  totalBC: number;
  totalCredito: number;
  percentualMedio: number;
  qtdItens: number;
}

export interface ReconciliacaoResult {
  porTTD: ReconciliacaoTTD[];
  porCP: ReconciliacaoCP[];
  totalGeralBC: number;
  totalGeralICMSRecolher: number;
  totalGeralFundos: number;
  totalGeralRecolherComFundos: number;
  /** Alternativa CAMEX 2,1% — agregado sobre itens CAMEX */
  totalGeralICMSRecolher21: number;
  totalGeralRecolherComFundos21: number;
  temCAMEX: boolean;
}

export function buildReconciliacao(
  results: NfeValidation[],
  regras?: RegrasConfig,
  config?: AppConfig,
): ReconciliacaoResult {
  const r = regras ?? getDefaultRegras();
  const cenariosMap = getCenarios(r);
  const listaCobreAco = config?.listaCobreAco ?? [];

  // --- TTD grouping ---
  const ttdMap = new Map<string, {
    cenarios: Set<string>;
    descricao: string;
    totalBC: number;
    totalICMSDestacado: number;
    cargaEfetiva: number;
    totalICMSRecolher: number;
    totalFundos: number;
    totalICMSRecolher21: number;
    temCAMEX: boolean;
    qtdItens: number;
    nfeChaves: Set<string>;
    temDivergencia: boolean;
  }>();

  // --- CP grouping ---
  const cpMap = new Map<string, {
    totalBC: number;
    totalCredito: number;
    totalPct: number;
    qtdItens: number;
  }>();

  for (const nv of results) {
    for (const iv of nv.itensValidados) {
      const cenario = cenariosMap[iv.cenario];
      const refTTD = cenario?.refTTD || iv.cenario;
      const descricao = cenario?.nome || iv.cenario;
      const isCA = isCobreAco(iv.item.ncm, listaCobreAco);
      // Deriva carga efetiva da aliquota real (corrige casos em que o cenario
      // classificado nao contempla o pICMS destacado — ex.: pICMS=10 em B1).
      const cargaEfetiva = cenario
        ? deriveCargaEfetiva(iv.item.pICMS, cenario, isCA)
        : 0;
      const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      // Recolher/fundos: centraliza em calculoHelpers. ICMS a recolher e
      // fundos sao SEMPRE calculados sobre a BC integral (mesmo quando ha
      // pRedBC > 0 — a reducao de BC nao reduz a obrigacao de recolhimento).
      // Devolucoes (sem CenarioConfig) usam derivacao por carga.
      const recolher = cenario
        ? calcularICMSRecolherItem(iv.item, cenario, isCA)
        : cargaEfetiva > 0 ? bc * (cargaEfetiva / 100) : 0;
      const fundosVal = cenario ? calcularFundosItem(iv.item, cenario) : 0;
      // Alternativa CAMEX: itens CAMEX com aliquota >= 7% podem recolher 2,1%
      // sobre a BC integral.
      const itemIsCAMEX = !!cenario?.isCAMEX && iv.item.pICMS >= 7;
      const recolher21 = itemIsCAMEX ? bc * (2.1 / 100) : recolher;

      const hasDivergencia = iv.statusFinal === 'ERRO' || iv.statusFinal === 'DIVERGENCIA';

      // TTD
      if (!ttdMap.has(refTTD)) {
        ttdMap.set(refTTD, {
          cenarios: new Set(),
          descricao,
          totalBC: 0,
          totalICMSDestacado: 0,
          cargaEfetiva,
          totalICMSRecolher: 0,
          totalFundos: 0,
          totalICMSRecolher21: 0,
          temCAMEX: false,
          qtdItens: 0,
          nfeChaves: new Set(),
          temDivergencia: false,
        });
      }
      const ttd = ttdMap.get(refTTD)!;
      ttd.cenarios.add(iv.cenario);
      ttd.totalBC += bc;
      ttd.totalICMSDestacado += iv.item.vICMS;
      ttd.totalICMSRecolher += recolher;
      ttd.totalICMSRecolher21 += recolher21;
      ttd.totalFundos += fundosVal;
      if (itemIsCAMEX) ttd.temCAMEX = true;
      ttd.qtdItens++;
      ttd.nfeChaves.add(nv.nfe.chaveAcesso);
      if (hasDivergencia) ttd.temDivergencia = true;

      // CP
      if (iv.item.cCredPresumido) {
        const cpKey = iv.item.cCredPresumido;
        if (!cpMap.has(cpKey)) {
          cpMap.set(cpKey, { totalBC: 0, totalCredito: 0, totalPct: 0, qtdItens: 0 });
        }
        const cp = cpMap.get(cpKey)!;
        cp.totalBC += bc;
        cp.totalCredito += iv.item.vCredPresumido || 0;
        cp.totalPct += iv.item.pCredPresumido || 0;
        cp.qtdItens++;
      }
    }
  }

  const porTTD: ReconciliacaoTTD[] = Array.from(ttdMap.entries())
    .map(([refTTD, data]) => ({
      refTTD,
      cenarios: Array.from(data.cenarios).sort(),
      descricao: data.descricao,
      totalBC: data.totalBC,
      totalICMSDestacado: data.totalICMSDestacado,
      cargaEfetiva: data.cargaEfetiva,
      totalICMSRecolher: data.totalICMSRecolher,
      totalFundos: data.totalFundos,
      totalRecolherComFundos: data.totalICMSRecolher + data.totalFundos,
      totalICMSRecolher21: data.totalICMSRecolher21,
      totalRecolherComFundos21: data.totalICMSRecolher21 + data.totalFundos,
      temCAMEX: data.temCAMEX,
      qtdItens: data.qtdItens,
      qtdNfes: data.nfeChaves.size,
      temDivergencia: data.temDivergencia,
    }))
    .sort((a, b) => a.refTTD.localeCompare(b.refTTD));

  const porCP: ReconciliacaoCP[] = Array.from(cpMap.entries())
    .map(([codigoCP, data]) => ({
      codigoCP,
      totalBC: data.totalBC,
      totalCredito: data.totalCredito,
      percentualMedio: data.qtdItens > 0 ? data.totalPct / data.qtdItens : 0,
      qtdItens: data.qtdItens,
    }))
    .sort((a, b) => a.codigoCP.localeCompare(b.codigoCP));

  const totalGeralBC = porTTD.reduce((s, t) => s + t.totalBC, 0);
  const totalGeralICMSRecolher = porTTD.reduce((s, t) => s + t.totalICMSRecolher, 0);
  const totalGeralFundos = porTTD.reduce((s, t) => s + t.totalFundos, 0);
  const totalGeralRecolherComFundos = totalGeralICMSRecolher + totalGeralFundos;
  const totalGeralICMSRecolher21 = porTTD.reduce((s, t) => s + t.totalICMSRecolher21, 0);
  const totalGeralRecolherComFundos21 = totalGeralICMSRecolher21 + totalGeralFundos;
  const temCAMEX = porTTD.some(t => t.temCAMEX);

  return {
    porTTD,
    porCP,
    totalGeralBC,
    totalGeralICMSRecolher,
    totalGeralFundos,
    totalGeralRecolherComFundos,
    totalGeralICMSRecolher21,
    totalGeralRecolherComFundos21,
    temCAMEX,
  };
}
