/**
 * Engine de Apuração TTD — espelha a estrutura do "Relatório da Apuração dos
 * Créditos por Regime Especial" emitido pela contabilidade para o TTD 410.
 *
 * Diferenças em relação a `apuracao.ts` (que serve a ReconciliacaoPanel):
 *  - Agrupa por CARGA EFETIVA (1,00% / 2,10% / 3,60%) e não por cenário.
 *  - Quebra interna por (operação interna/interestadual) × (com/sem redução BC).
 *  - Linha = NF × alíquota: uma NF com itens em alíquotas diferentes vira N linhas.
 *  - Permite override manual da classificação CAMEX 2,10 vs 3,60.
 *  - Calcula os 4 fundos (FUNDEC, FUMDES, Pró-Emprego, Fundo Social).
 */

import type { NfeValidation, ItemValidation } from '../types/validation.ts';
import type { ItemData, NfeData } from '../types/nfe.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import { getCenarios } from './cenarios.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { bcIntegral } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { deriveCargaEfetiva } from './calculoHelpers.ts';
import { extrairPeriodo } from './apuracao.ts';
import { calcularFundosTTD, type FundosTTD } from './fundosTTD.ts';

// --- Tipos publicos ---

export type CargaEfetivaKey = 1.0 | 2.1 | 3.6;
export type OperacaoTipo = 'interna' | 'interestadual';
export type ReducaoBcTipo = 'sem_reducao' | 'com_reducao';

export type CamexOrigem =
  | 'auto_industrial'
  | 'auto_cnae'
  | 'auto_lista210'
  | 'manual_nf'
  | 'manual_par'
  | 'inherited'
  | 'auto_default';

/** Linha NF×alíquota — uma NF com itens em alíquotas diferentes vira N linhas */
export interface ApuracaoLinha {
  chaveAcesso: string;
  numero: string;
  dhEmi: string;
  /** dd/MM/yyyy formatado para exibição */
  data: string;
  /** Soma vProd + vFrete + vSeg + vOutro − vDesc dos itens desta linha */
  valorContabil: number;
  /** Soma de bcIntegral(vBC, pRedBC) dos itens desta linha */
  bcIntegral: number;
  /** Soma vBC declarado (pode ser reduzida) — útil para conferência com PDF */
  bcDeclarada: number;
  /** Alíquota desta linha */
  pICMS: number;
  /** Soma vICMS destacado dos itens */
  vICMS: number;
  /** Crédito presumido = max(0, vICMS − bcIntegral × cargaEfetiva / 100) */
  vCP: number;
  /** Maior pRedBC entre itens desta linha (0 quando sem redução) */
  pRedBCMaximo: number;
  /** Carga efetiva aplicada (1,0 / 2,1 / 3,6 / 0,6 etc) */
  cargaEfetiva: number;
  /** True quando os itens desta linha sao CAMEX (cstOrig=6 ou NCM em listaCamex) */
  isCAMEX: boolean;
  /** True quando a NF original possui itens em outros buckets de carga */
  temItensOutrasCargas: boolean;
  /** Origem da decisão CAMEX (apenas para itens CAMEX) */
  origemCAMEX?: CamexOrigem;
  /** UF destino — usado pela UI para detalhamento */
  ufDest: string;
  /** CNPJ do destinatário (sanitizado) — vazio se PF */
  cnpjDest: string;
  /** Razão social do destinatário */
  destNome: string;
  /** Valor total da NF (vNF do totalizador) */
  vNF: number;
  /** NCMs presentes nesta linha — usado para overrides "por par" */
  ncms: string[];
}

export interface ApuracaoSubgrupo {
  reducaoBC: ReducaoBcTipo;
  linhas: ApuracaoLinha[];
  totalBC: number;
  totalVICMS: number;
  totalCP: number;
}

export interface ApuracaoOperacaoBlock {
  tipo: OperacaoTipo;
  subgrupos: ApuracaoSubgrupo[];
  totalBC: number;
  totalVICMS: number;
  totalCP: number;
}

export interface ApuracaoCargaBlock {
  carga: CargaEfetivaKey;
  /** True quando o bloco eh dedicado a itens CAMEX. Permite split do bucket
   *  3,60% em "12% CAMEX (TTD 1.2.b.1)" e "10%/12% sem CAMEX (TTD 1.2.b.2/1.2.e)". */
  isCAMEX: boolean;
  aliquotaLabel: string;
  refTTDLabel: string;
  operacoes: ApuracaoOperacaoBlock[];
  totalBC: number;
  totalVICMS: number;
  totalCP: number;
}

export interface ApuracaoTTDResult {
  periodo: string;
  cargas: ApuracaoCargaBlock[];
  totalBCGlobal: number;
  totalVICMSGlobal: number;
  totalCPGlobal: number;
  fundos: FundosTTD;
}

// --- Camex override map (estrutura espelhada em camexOverrideService.ts) ---

export interface CamexOverrideEntry {
  carga: 2.1 | 3.6;
  origem: 'manual_nf' | 'manual_par' | 'inherited';
}

export interface CamexOverrideMap {
  byChave: Map<string, CamexOverrideEntry>;
  /** Key: `${cnpjDestSanitizado}_${ncmNormalizado}` */
  byPar: Map<string, CamexOverrideEntry>;
}

/** Constrói um map vazio. */
export function emptyOverrideMap(): CamexOverrideMap {
  return { byChave: new Map(), byPar: new Map() };
}

// --- Helpers internos ---

function normalizarCnpj(cnpj: string | undefined): string {
  return (cnpj ?? '').replace(/\D/g, '');
}

function normalizarNcm(ncm: string): string {
  return ncm.replace(/\./g, '');
}

function parKey(cnpjDest: string, ncm: string): string {
  return `${normalizarCnpj(cnpjDest)}_${normalizarNcm(ncm)}`;
}

function isItemCAMEX(item: ItemData, config: AppConfig): boolean {
  if (item.cstOrig === '6') return true;
  const ncmNorm = normalizarNcm(item.ncm);
  return config.listaCamex.some(c => ncmNorm.startsWith(normalizarNcm(c)));
}

function isItemIndustrialAuto(
  iv: ItemValidation,
): { industrial: boolean; origem: CamexOrigem } {
  // Heurística: se o classificador caiu em B2-Industrial, foi por lista ou CNAE.
  // Não temos a origem exata aqui, retornamos 'auto_industrial' para ambos os
  // casos (lista e CNAE). Se quiser distinguir, propagar do classifier.
  if (iv.cenario === 'B2-Industrial') {
    return { industrial: true, origem: 'auto_industrial' };
  }
  return { industrial: false, origem: 'auto_default' };
}

function formatarData(dhEmi: string): string {
  if (!dhEmi) return '';
  const m = dhEmi.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dhEmi;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function valorContabilItem(item: ItemData): number {
  return (
    (item.vProd || 0) +
    (item.vFrete || 0) +
    (item.vSeg || 0) +
    (item.vOutro || 0) -
    (item.vDesc || 0)
  );
}

/**
 * Resolve a carga efetiva real do item considerando overrides CAMEX.
 * Retorna a carga, a origem da decisão CAMEX e a flag isCAMEX (para
 * permitir split visual de buckets — ex.: 3,60% CAMEX vs 3,60% sem CAMEX).
 */
function resolverCargaItem(
  item: ItemData,
  iv: ItemValidation,
  nfe: NfeData,
  cenario: CenarioConfig | undefined,
  config: AppConfig,
  overrides: CamexOverrideMap,
): { carga: number; isCAMEX: boolean; origemCAMEX?: CamexOrigem } {
  if (!cenario) {
    // Sem cenário (devolução, vedado, desconhecido) — não entra na apuração
    return { carga: 0, isCAMEX: false };
  }

  const isCA = isCobreAco(item.ncm, config.listaCobreAco);
  const cargaPadrao = deriveCargaEfetiva(item.pICMS, cenario, isCA);

  // Override só faz sentido para itens CAMEX com alíquota >= 7%
  const itemCAMEX = isItemCAMEX(item, config);
  if (!itemCAMEX || item.pICMS < 7) {
    return { carga: cargaPadrao, isCAMEX: itemCAMEX };
  }

  // 1) Override por chave de acesso
  const ov1 = overrides.byChave.get(nfe.chaveAcesso);
  if (ov1) return { carga: ov1.carga, isCAMEX: true, origemCAMEX: ov1.origem };

  // 2) Override por par (cnpjDest, ncm)
  const cnpjDest = normalizarCnpj(nfe.dest.cnpj);
  if (cnpjDest) {
    const ov2 = overrides.byPar.get(parKey(cnpjDest, item.ncm));
    if (ov2) return { carga: ov2.carga, isCAMEX: true, origemCAMEX: ov2.origem };
  }

  // 3) Classificação automática via cenário B2-Industrial (lista ou CNAE)
  const auto = isItemIndustrialAuto(iv);
  if (auto.industrial) {
    return { carga: 3.6, isCAMEX: true, origemCAMEX: auto.origem };
  }

  // 3.5) CNPJ destino na lista de CAMEX 2,10% (cadastro)
  const cnpjDestNorm = normalizarCnpj(nfe.dest.cnpj);
  if (cnpjDestNorm && config.listaCamex210.includes(cnpjDestNorm)) {
    return { carga: 2.1, isCAMEX: true, origemCAMEX: 'auto_lista210' };
  }

  // 4) Default CAMEX: 3,60.
  return { carga: 3.6, isCAMEX: true, origemCAMEX: 'auto_default' };
}

/**
 * Mapeia carga numérica para o "bucket" canônico de exibição.
 * Cargas atípicas (0,6 cobre/aço, 0 diferimento etc.) são absorvidas no bucket
 * mais próximo: 0,6 → 1,0 (mesma família 4%); 0/negativo → ignorado.
 */
function bucketCarga(carga: number): CargaEfetivaKey | null {
  if (carga <= 0) return null;
  if (Math.abs(carga - 1.0) < 0.05) return 1.0;
  if (Math.abs(carga - 0.6) < 0.05) return 1.0; // cobre/aço entra no bucket 1%
  if (Math.abs(carga - 2.1) < 0.05) return 2.1;
  if (Math.abs(carga - 3.6) < 0.05) return 3.6;
  // Carga atípica — empurra para o bucket mais próximo
  if (carga < 1.5) return 1.0;
  if (carga < 3.0) return 2.1;
  return 3.6;
}

interface LinhaAcumulada {
  // chaves de agrupamento
  chaveAcesso: string;
  carga: CargaEfetivaKey;
  isCAMEX: boolean;
  pICMS: number;
  operacao: OperacaoTipo;
  reducaoBC: ReducaoBcTipo;
  // dados acumulados
  numero: string;
  dhEmi: string;
  cnpjDest: string;
  destNome: string;
  ufDest: string;
  vNF: number;
  ncmsSet: Set<string>;
  valorContabil: number;
  bcIntegral: number;
  bcDeclarada: number;
  vICMS: number;
  pRedBCMaximo: number;
  cargaEfetivaUsada: number;
  origemCAMEXAgregada?: CamexOrigem;
}

function linhaKey(
  chave: string,
  carga: CargaEfetivaKey,
  isCAMEX: boolean,
  pICMS: number,
  operacao: OperacaoTipo,
  reducao: ReducaoBcTipo,
): string {
  return `${chave}|${carga}|${isCAMEX ? 'C' : 'N'}|${pICMS.toFixed(2)}|${operacao}|${reducao}`;
}

function aliquotaLabelFor(carga: CargaEfetivaKey, isCAMEX: boolean): string {
  if (carga === 1.0) return '4%';
  if (carga === 2.1) return '12% CAMEX';
  // carga 3.6
  if (isCAMEX) return '12% CAMEX (recolhimento padrao)';
  return '10% / 12% sem CAMEX';
}

function refTTDLabelFor(carga: CargaEfetivaKey, isCAMEX: boolean): string {
  if (carga === 1.0) return '1.2.a / 1.13.c';
  if (carga === 2.1) return '1.2.d / 1.13.a';
  // carga 3.6
  if (isCAMEX) return '1.2.b.1 / 1.13.a';
  return '1.2.b.2 / 1.2.e';
}

/** Lista canônica de buckets na ordem de exibição. Buckets vazios são
 *  filtrados pela UI/Excel. */
const BUCKETS_ORDEM: Array<{ carga: CargaEfetivaKey; isCAMEX: boolean }> = [
  { carga: 1.0, isCAMEX: false },
  { carga: 1.0, isCAMEX: true },  // raro: cobre/aço CAMEX 4%? mantém pra completude
  { carga: 2.1, isCAMEX: true },
  { carga: 3.6, isCAMEX: true },
  { carga: 3.6, isCAMEX: false },
];

// --- Funcao publica ---

export function buildApuracaoTTD(
  results: NfeValidation[],
  regras: RegrasConfig | undefined,
  config: AppConfig,
  overrides: CamexOverrideMap,
  periodo?: string,
): ApuracaoTTDResult {
  const r = regras ?? getDefaultRegras();
  const cenariosMap = getCenarios(r);

  // Filtro por período (se informado)
  const filtrado = periodo
    ? results.filter(nv => extrairPeriodo(nv.nfe.dhEmi) === periodo)
    : results;
  const periodoFinal =
    periodo ?? (filtrado[0] ? extrairPeriodo(filtrado[0].nfe.dhEmi) : '');

  // Acumulação: 1 chave por (NF, carga, isCAMEX, alíquota, operação, redução)
  const acc = new Map<string, LinhaAcumulada>();
  // Buckets distintos presentes em cada chaveAcesso (para "temItensOutrasCargas")
  // Key do set = `${carga}|${isCAMEX ? 'C' : 'N'}`
  const bucketsPorNf = new Map<string, Set<string>>();

  for (const nv of filtrado) {
    for (const iv of nv.itensValidados) {
      const cenario = cenariosMap[iv.cenario];
      const { carga, isCAMEX, origemCAMEX } = resolverCargaItem(
        iv.item,
        iv,
        nv.nfe,
        cenario,
        config,
        overrides,
      );
      const bucket = bucketCarga(carga);
      if (bucket === null) continue; // ignora itens sem carga (devolução, diferimento total)

      const operacao: OperacaoTipo =
        nv.nfe.dest.uf.toUpperCase() === 'SC' ? 'interna' : 'interestadual';
      const reducao: ReducaoBcTipo =
        iv.item.pRedBC > 0 ? 'com_reducao' : 'sem_reducao';
      const key = linhaKey(
        nv.nfe.chaveAcesso,
        bucket,
        isCAMEX,
        iv.item.pICMS,
        operacao,
        reducao,
      );

      let linha = acc.get(key);
      if (!linha) {
        linha = {
          chaveAcesso: nv.nfe.chaveAcesso,
          carga: bucket,
          isCAMEX,
          pICMS: iv.item.pICMS,
          operacao,
          reducaoBC: reducao,
          numero: nv.nfe.numero,
          dhEmi: nv.nfe.dhEmi,
          cnpjDest: normalizarCnpj(nv.nfe.dest.cnpj),
          destNome: nv.nfe.dest.nome,
          ufDest: nv.nfe.dest.uf.toUpperCase(),
          vNF: nv.nfe.totais.vNF,
          ncmsSet: new Set<string>(),
          valorContabil: 0,
          bcIntegral: 0,
          bcDeclarada: 0,
          vICMS: 0,
          pRedBCMaximo: 0,
          cargaEfetivaUsada: carga,
          origemCAMEXAgregada: origemCAMEX,
        };
        acc.set(key, linha);
      }

      const bcInt = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      linha.valorContabil += valorContabilItem(iv.item);
      linha.bcIntegral += bcInt;
      linha.bcDeclarada += iv.item.vBC;
      linha.vICMS += iv.item.vICMS;
      if (iv.item.pRedBC > linha.pRedBCMaximo) linha.pRedBCMaximo = iv.item.pRedBC;
      if (iv.item.ncm) linha.ncmsSet.add(iv.item.ncm);
      // Se origens divergirem dentro da mesma linha, prioriza manual
      if (origemCAMEX && (!linha.origemCAMEXAgregada || origemCAMEX.startsWith('manual'))) {
        linha.origemCAMEXAgregada = origemCAMEX;
      }

      // Registra bucket distinto para a NF (carga + isCAMEX)
      let buckets = bucketsPorNf.get(nv.nfe.chaveAcesso);
      if (!buckets) {
        buckets = new Set();
        bucketsPorNf.set(nv.nfe.chaveAcesso, buckets);
      }
      buckets.add(`${bucket}|${isCAMEX ? 'C' : 'N'}`);
    }
  }

  // Materializar linhas finais (com vCP e flag temItensOutrasCargas)
  const linhasFinal: ApuracaoLinha[] = Array.from(acc.values()).map(l => {
    const vICMSEsperado = l.bcIntegral * (l.carga / 100);
    const vCP = Math.max(0, l.vICMS - vICMSEsperado);
    return {
      chaveAcesso: l.chaveAcesso,
      numero: l.numero,
      dhEmi: l.dhEmi,
      data: formatarData(l.dhEmi),
      valorContabil: round2(l.valorContabil),
      bcIntegral: round2(l.bcIntegral),
      bcDeclarada: round2(l.bcDeclarada),
      pICMS: l.pICMS,
      vICMS: round2(l.vICMS),
      vCP: round2(vCP),
      pRedBCMaximo: l.pRedBCMaximo,
      cargaEfetiva: l.carga,
      isCAMEX: l.isCAMEX,
      temItensOutrasCargas: (bucketsPorNf.get(l.chaveAcesso)?.size ?? 0) > 1,
      origemCAMEX: l.origemCAMEXAgregada,
      ufDest: l.ufDest,
      cnpjDest: l.cnpjDest,
      destNome: l.destNome,
      vNF: l.vNF,
      ncms: Array.from(l.ncmsSet).sort(),
    };
  });

  // Agrupar em buckets (carga, isCAMEX) → operações → subgrupos. Mantém a
  // ordem canônica de BUCKETS_ORDEM e descarta buckets sem linhas.
  const cargas: ApuracaoCargaBlock[] = BUCKETS_ORDEM
    .map(b => construirBlocoCarga(
      b.carga,
      b.isCAMEX,
      linhasFinal.filter(l => l.cargaEfetiva === b.carga && l.isCAMEX === b.isCAMEX),
    ))
    .filter(c => c.totalBC > 0);

  // Totais globais
  const totalBCGlobal = cargas.reduce((s, c) => s + c.totalBC, 0);
  const totalVICMSGlobal = cargas.reduce((s, c) => s + c.totalVICMS, 0);
  const totalCPGlobal = cargas.reduce((s, c) => s + c.totalCP, 0);

  const fundos = calcularFundosTTD(totalBCGlobal, totalCPGlobal);

  return {
    periodo: periodoFinal,
    cargas,
    totalBCGlobal: round2(totalBCGlobal),
    totalVICMSGlobal: round2(totalVICMSGlobal),
    totalCPGlobal: round2(totalCPGlobal),
    fundos,
  };
}

function construirBlocoCarga(
  carga: CargaEfetivaKey,
  isCAMEX: boolean,
  linhas: ApuracaoLinha[],
): ApuracaoCargaBlock {
  const operacoes: ApuracaoOperacaoBlock[] = [];

  for (const tipo of ['interna', 'interestadual'] as OperacaoTipo[]) {
    const linhasOp = linhas.filter(l => operacaoDaLinha(l) === tipo);
    if (linhasOp.length === 0 && tipo === 'interestadual') continue;

    const semRed = linhasOp.filter(l => l.pRedBCMaximo === 0);
    const comRed = linhasOp.filter(l => l.pRedBCMaximo > 0);

    const subgrupos: ApuracaoSubgrupo[] = [];
    // Sempre incluir sem_reducao (mesmo vazio?) — decisão do plano: só se houver linhas
    if (semRed.length > 0) {
      subgrupos.push(montarSubgrupo('sem_reducao', semRed));
    }
    if (comRed.length > 0) {
      subgrupos.push(montarSubgrupo('com_reducao', comRed));
    }

    if (subgrupos.length === 0) continue;

    const totalBC = subgrupos.reduce((s, sg) => s + sg.totalBC, 0);
    const totalVICMS = subgrupos.reduce((s, sg) => s + sg.totalVICMS, 0);
    const totalCP = subgrupos.reduce((s, sg) => s + sg.totalCP, 0);

    operacoes.push({
      tipo,
      subgrupos,
      totalBC: round2(totalBC),
      totalVICMS: round2(totalVICMS),
      totalCP: round2(totalCP),
    });
  }

  const totalBC = operacoes.reduce((s, o) => s + o.totalBC, 0);
  const totalVICMS = operacoes.reduce((s, o) => s + o.totalVICMS, 0);
  const totalCP = operacoes.reduce((s, o) => s + o.totalCP, 0);

  return {
    carga,
    isCAMEX,
    aliquotaLabel: aliquotaLabelFor(carga, isCAMEX),
    refTTDLabel: refTTDLabelFor(carga, isCAMEX),
    operacoes,
    totalBC: round2(totalBC),
    totalVICMS: round2(totalVICMS),
    totalCP: round2(totalCP),
  };
}

function operacaoDaLinha(l: ApuracaoLinha): OperacaoTipo {
  return l.ufDest === 'SC' ? 'interna' : 'interestadual';
}

function montarSubgrupo(
  reducaoBC: ReducaoBcTipo,
  linhas: ApuracaoLinha[],
): ApuracaoSubgrupo {
  // Ordenar por dhEmi e depois por número de NF (estável)
  const ordenadas = [...linhas].sort((a, b) => {
    if (a.dhEmi !== b.dhEmi) return a.dhEmi.localeCompare(b.dhEmi);
    return a.numero.localeCompare(b.numero);
  });
  const totalBC = ordenadas.reduce((s, l) => s + l.bcIntegral, 0);
  const totalVICMS = ordenadas.reduce((s, l) => s + l.vICMS, 0);
  const totalCP = ordenadas.reduce((s, l) => s + l.vCP, 0);
  return {
    reducaoBC,
    linhas: ordenadas,
    totalBC: round2(totalBC),
    totalVICMS: round2(totalVICMS),
    totalCP: round2(totalCP),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
