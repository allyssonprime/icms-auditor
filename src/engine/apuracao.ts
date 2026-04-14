import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { getCenarios } from './cenarios.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { bcIntegral } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { deriveCargaEfetiva, calcularICMSRecolherItem, calcularFundosItem } from './calculoHelpers.ts';

/**
 * Apuração mensal consolidada — insumo para planilha 7.7/7.8 e para a
 * confrontação com a contabilidade/DIME.
 *
 * Diferenças em relação a `buildReconciliacao`:
 *  - Agrupa por período (AAAA-MM a partir de `nfe.dhEmi`)
 *  - Separa devoluções (cenário 'DEVOLUCAO') de saídas normais
 *  - Emite lista de divergências itemizadas para auditoria
 *  - Quebra totais por cenário (necessário para DIME quadro 46)
 */

export interface ApuracaoCenario {
  cenarioId: string;
  refTTD: string;
  descricao: string;
  qtdItens: number;
  qtdNfes: number;
  totalBC: number;
  totalICMSDestacado: number;
  totalCPApropriado: number;
  totalICMSRecolher: number;
  totalFundos: number;
  cargaEfetiva: number;
}

export interface ApuracaoDivergencia {
  chaveAcesso: string;
  numero: string;
  nItem: string;
  cenarioId: string;
  regra: string;
  mensagem: string;
  status: 'ERRO' | 'DIVERGENCIA' | 'AVISO';
}

export interface ApuracaoMensal {
  periodo: string; // "AAAA-MM"
  // Saídas
  totalBCSaidas: number;
  totalICMSDestacado: number;
  totalCPApropriado: number;
  totalICMSRecolher: number;
  totalFundos: number;
  totalRecolherComFundos: number;
  // Devoluções
  totalBCDevolucoes: number;
  totalCPEstornado: number;
  totalFundosCredito: number;
  // Líquido (saídas - devoluções)
  liquidoICMSRecolher: number;
  liquidoFundos: number;
  liquidoTotal: number;
  // Breakdown
  porCenario: ApuracaoCenario[];
  // Auditoria
  divergencias: ApuracaoDivergencia[];
  qtdNfes: number;
  qtdItens: number;
}

export interface DadosContabilidade {
  icmsDebitado: number;
  icmsCreditado: number;
  cpApropriado: number;
  fundosRecolhidos: number;
}

export interface ConfrontacaoResult {
  diffICMS: number;
  diffCP: number;
  diffFundos: number;
  status: 'ok' | 'atencao' | 'divergente';
  observacoes: string[];
}

const TAXA_FUNDOS_FLAT = 0.4; // 0,4% flat sobre BC integral

/**
 * Extrai período "AAAA-MM" de dhEmi (formato ISO 8601 padrão NF-e)
 * ou string vazia se não puder determinar.
 */
export function extrairPeriodo(dhEmi: string): string {
  if (!dhEmi) return '';
  const match = dhEmi.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

interface CenarioAcc {
  refTTD: string;
  descricao: string;
  qtdItens: number;
  nfeChaves: Set<string>;
  totalBC: number;
  totalICMSDestacado: number;
  totalCPApropriado: number;
  totalICMSRecolher: number;
  totalFundos: number;
  cargaEfetiva: number;
}

/**
 * Constrói apuração mensal a partir de um conjunto de `NfeValidation`.
 *
 * Se `periodo` for informado, apenas NF-es com `dhEmi` no mesmo período são
 * consideradas. Caso contrário, usa o período da primeira NF-e encontrada ou
 * uma string vazia se nenhuma tiver `dhEmi`.
 */
export function buildApuracaoMensal(
  results: NfeValidation[],
  regras?: RegrasConfig,
  config?: AppConfig,
  periodo?: string,
): ApuracaoMensal {
  const r = regras ?? getDefaultRegras();
  const cenariosMap = getCenarios(r);
  const listaCobreAco = config?.listaCobreAco ?? [];

  // Filtra por período se informado
  const filtrado = periodo
    ? results.filter(nv => extrairPeriodo(nv.nfe.dhEmi) === periodo)
    : results;

  const periodoFinal =
    periodo ?? (filtrado[0] ? extrairPeriodo(filtrado[0].nfe.dhEmi) : '');

  // Saídas normais
  let totalBCSaidas = 0;
  let totalICMSDestacado = 0;
  let totalCPApropriado = 0;
  let totalICMSRecolher = 0;
  let totalFundos = 0;

  // Devoluções
  let totalBCDevolucoes = 0;
  let totalCPEstornado = 0;
  let totalFundosCredito = 0;

  const cenarioAcc = new Map<string, CenarioAcc>();
  const divergencias: ApuracaoDivergencia[] = [];
  const nfeChavesGlobal = new Set<string>();
  let qtdItens = 0;

  for (const nv of filtrado) {
    nfeChavesGlobal.add(nv.nfe.chaveAcesso);
    for (const iv of nv.itensValidados) {
      qtdItens++;
      const cenario = cenariosMap[iv.cenario];
      const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      const isCA = isCobreAco(iv.item.ncm, listaCobreAco);
      const cargaEfetiva = cenario
        ? deriveCargaEfetiva(iv.item.pICMS, cenario, isCA)
        : 0;
      // Recolher: SEMPRE bcIntegral × cargaEfetiva (regra fiscal — reducao
      // de BC nao reduz a obrigacao de recolhimento). Devolucoes (sem
      // CenarioConfig) usam derivacao por carga sobre bcIntegral.
      const recolher = cenario
        ? calcularICMSRecolherItem(iv.item, cenario, isCA)
        : cargaEfetiva > 0 ? bc * (cargaEfetiva / 100) : 0;
      // Fundos: prioriza o % do cenário (quando definido); devoluções (que
      // não têm CenarioConfig) usam a taxa flat de 0,4% — crédito a estornar.
      const fundosVal = cenario
        ? calcularFundosItem(iv.item, cenario)
        : TAXA_FUNDOS_FLAT > 0 ? bc * (TAXA_FUNDOS_FLAT / 100) : 0;
      const cpAproprido = iv.item.vCredPresumido || 0;

      // Coletar divergências para auditoria
      for (const res of iv.resultados) {
        if (res.status === 'ERRO' || res.status === 'DIVERGENCIA' || res.status === 'AVISO') {
          divergencias.push({
            chaveAcesso: nv.nfe.chaveAcesso,
            numero: nv.nfe.numero,
            nItem: iv.item.nItem,
            cenarioId: iv.cenario,
            regra: res.regra,
            mensagem: res.mensagem,
            status: res.status,
          });
        }
      }

      if (iv.cenario === 'DEVOLUCAO') {
        totalBCDevolucoes += bc;
        totalCPEstornado += cpAproprido;
        totalFundosCredito += fundosVal;
        continue;
      }

      totalBCSaidas += bc;
      totalICMSDestacado += iv.item.vICMS;
      totalCPApropriado += cpAproprido;
      totalICMSRecolher += recolher;
      totalFundos += fundosVal;

      // Breakdown por cenário
      const key = iv.cenario;
      if (!cenarioAcc.has(key)) {
        cenarioAcc.set(key, {
          refTTD: cenario?.refTTD || key,
          descricao: cenario?.nome || key,
          qtdItens: 0,
          nfeChaves: new Set(),
          totalBC: 0,
          totalICMSDestacado: 0,
          totalCPApropriado: 0,
          totalICMSRecolher: 0,
          totalFundos: 0,
          cargaEfetiva,
        });
      }
      const acc = cenarioAcc.get(key)!;
      acc.qtdItens++;
      acc.nfeChaves.add(nv.nfe.chaveAcesso);
      acc.totalBC += bc;
      acc.totalICMSDestacado += iv.item.vICMS;
      acc.totalCPApropriado += cpAproprido;
      acc.totalICMSRecolher += recolher;
      acc.totalFundos += fundosVal;
    }
  }

  const totalRecolherComFundos = totalICMSRecolher + totalFundos;
  const liquidoICMSRecolher = totalICMSRecolher; // devoluções não reduzem ICMS a recolher
  const liquidoFundos = totalFundos - totalFundosCredito;
  const liquidoTotal = liquidoICMSRecolher + liquidoFundos;

  const porCenario: ApuracaoCenario[] = Array.from(cenarioAcc.entries())
    .map(([cenarioId, acc]) => ({
      cenarioId,
      refTTD: acc.refTTD,
      descricao: acc.descricao,
      qtdItens: acc.qtdItens,
      qtdNfes: acc.nfeChaves.size,
      totalBC: acc.totalBC,
      totalICMSDestacado: acc.totalICMSDestacado,
      totalCPApropriado: acc.totalCPApropriado,
      totalICMSRecolher: acc.totalICMSRecolher,
      totalFundos: acc.totalFundos,
      cargaEfetiva: acc.cargaEfetiva,
    }))
    .sort((a, b) => a.cenarioId.localeCompare(b.cenarioId));

  return {
    periodo: periodoFinal,
    totalBCSaidas,
    totalICMSDestacado,
    totalCPApropriado,
    totalICMSRecolher,
    totalFundos,
    totalRecolherComFundos,
    totalBCDevolucoes,
    totalCPEstornado,
    totalFundosCredito,
    liquidoICMSRecolher,
    liquidoFundos,
    liquidoTotal,
    porCenario,
    divergencias,
    qtdNfes: nfeChavesGlobal.size,
    qtdItens,
  };
}

/**
 * Confronta apuração do sistema com dados informados pela contabilidade/DIME.
 *
 * Semáforo:
 *  - `ok`: todas as diferenças < 1% do maior valor comparado
 *  - `atencao`: alguma diferença entre 1% e 5%
 *  - `divergente`: alguma diferença > 5% ou > R$ 1.000,00 absoluto
 *
 * Convenção: `diff = sistema - contabilidade` (positivo = sistema apurou mais).
 */
export function confrontarContabilidade(
  apuracao: ApuracaoMensal,
  contab: DadosContabilidade,
): ConfrontacaoResult {
  const icmsContabilLiquido = contab.icmsDebitado - contab.icmsCreditado;
  const diffICMS = apuracao.liquidoICMSRecolher - icmsContabilLiquido;
  const diffCP = apuracao.totalCPApropriado - contab.cpApropriado;
  const diffFundos = apuracao.liquidoFundos - contab.fundosRecolhidos;

  const observacoes: string[] = [];
  let maxPct = 0;
  let maxAbs = 0;

  const checkLinha = (
    label: string,
    diff: number,
    sistemaVal: number,
    contabVal: number,
  ) => {
    const base = Math.max(Math.abs(sistemaVal), Math.abs(contabVal));
    const pct = base > 0 ? (Math.abs(diff) / base) * 100 : 0;
    if (Math.abs(diff) > maxAbs) maxAbs = Math.abs(diff);
    if (pct > maxPct) maxPct = pct;
    if (Math.abs(diff) >= 0.01) {
      const sentido = diff > 0 ? 'sistema apurou a mais' : 'contabilidade apurou a mais';
      observacoes.push(
        `${label}: diferença R$ ${diff.toFixed(2)} (${pct.toFixed(2)}% — ${sentido}).`,
      );
    }
  };

  checkLinha('ICMS', diffICMS, apuracao.liquidoICMSRecolher, icmsContabilLiquido);
  checkLinha('CP', diffCP, apuracao.totalCPApropriado, contab.cpApropriado);
  checkLinha('Fundos', diffFundos, apuracao.liquidoFundos, contab.fundosRecolhidos);

  let status: ConfrontacaoResult['status'];
  if (maxPct > 5 || maxAbs > 1000) {
    status = 'divergente';
  } else if (maxPct > 1) {
    status = 'atencao';
  } else {
    status = 'ok';
  }

  if (observacoes.length === 0) {
    observacoes.push('Apuração do sistema e contabilidade convergem (diferenças < R$ 0,01).');
  }

  return {
    diffICMS,
    diffCP,
    diffFundos,
    status,
    observacoes,
  };
}

/**
 * Taxa de fundos utilizada na apuração (expõe para consumidores
 * que precisam documentar o método — ex.: planilha 7.8).
 */
export function getTaxaFundos(): number {
  return TAXA_FUNDOS_FLAT;
}
