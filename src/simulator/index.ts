import { CENARIOS } from '../engine/cenarios.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { AppConfig } from '../types/config.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { calcularTTD } from './calculator.ts';

// ── Tipos de entrada ────────────────────────────────────────────

export type RegimeTributario = 'normal' | 'simples_nacional' | 'nao_contribuinte';
export type AplicacaoProduto = 'industrializacao' | 'uso_consumo' | 'revenda' | 'ativo_permanente';

export interface SimuladorParams {
  /** UF do destinatário (ex: "SC", "SP") */
  destUf: string;
  /** Regime tributário do destinatário */
  destRegime: RegimeTributario;
  /** CNPJ do destinatário (para lookup em listas) */
  destCnpj?: string;
  /** É pessoa física? */
  isPessoaFisica?: boolean;
  /** NCM do produto (ex: "8471.30.19") */
  ncm: string;
  /** Tipo de aplicação do item */
  aplicacao?: AplicacaoProduto;
  /** Valor da operação em R$ */
  valorOperacao: number;
  /** CST origem do item (default "1" = importação direta) */
  cstOrigem?: string;
  /** Mercadoria tem substituição tributária? */
  temST?: boolean;
  /** Produto consta na lista CAMEX? */
  isCamex?: boolean;
  /** Destinatário é industrial? */
  isIndustrial?: boolean;
}

// ── Tipo de saída ───────────────────────────────────────────────

export interface SimuladorResult {
  aliquotaDestacada: number;
  icmsDestacado: number;
  icmsRecolhimento: { valor: number; pct: number };
  fundosSociais: { valor: number; pct: number };
  totalRecolher: { valor: number; pct: number };
  creditoPresumido: number;
  cenarioClassificado: string;
  cenarioNome: string;
  refTTD: string;
  observacoes: string[];
  bcIntegral: number;
  ncm: string;
  isVedado: boolean;
  vedacaoMsg: string;
}

// ── Classificação do cenário ────────────────────────────────────

function classificarCenarioSimulador(
  params: SimuladorParams,
  config: AppConfig,
): string {
  const isInterestadual = params.destUf.toUpperCase() !== 'SC';
  const isPF = params.isPessoaFisica === true;
  const isNaoContrib = !isPF && params.destRegime === 'nao_contribuinte';
  const isContrib = params.destRegime === 'normal';
  const isSN = params.destRegime === 'simples_nacional';

  const isCAMEX = params.isCamex === true;
  const cobreAco = isCobreAco(params.ncm, config.listaCobreAco);
  const temST = params.temST === true;

  // === INTERESTADUAIS ===
  if (isInterestadual) {
    if (cobreAco && isContrib && !isCAMEX) return 'A8';

    if (isCAMEX) {
      if (isContrib || isSN) return 'A2';
      if (isNaoContrib) return 'A5';
      if (isPF) return 'A7';
    }

    if (isContrib || isSN) return 'A1';
    if (isNaoContrib) return 'A4';
    if (isPF) return 'A6';
  }

  // === INTERNAS (SC) ===
  // Vedações especiais
  if (params.destCnpj && config.listaVedacao25a.includes(params.destCnpj)) return 'B9';
  if (params.destCnpj && config.listaVedacao25b.includes(params.destCnpj)) return 'B10';

  // CD exclusivo
  if (params.destCnpj && config.listaCD.includes(params.destCnpj)) return 'B11';

  // Pessoa Física — SEM crédito presumido
  if (isPF) return 'B7';

  // PJ Não Contribuinte
  if (isNaoContrib) return isCAMEX ? 'B6-CAMEX' : 'B6';

  // Simples Nacional
  if (isSN) {
    if (temST) return isCAMEX ? 'B4-CAMEX' : 'B4';
    return isCAMEX ? 'B5-CAMEX' : 'B5';
  }

  // Contribuinte Normal
  if (isContrib) {
    if (isCAMEX) return 'B2';
    if (params.isIndustrial === true) return 'B3';
    // Only check list when isIndustrial was not explicitly set to false
    if (params.isIndustrial !== false && params.destCnpj && config.listaIndustriais.includes(params.destCnpj)) return 'B3';
    return 'B1';
  }

  return 'DESCONHECIDO';
}

// ── Observações por cenário ─────────────────────────────────────

function gerarObservacoes(cenarioId: string, params: SimuladorParams): string[] {
  const obs: string[] = [];

  switch (cenarioId) {
    case 'B3':
      obs.push('Opção 10% para industrial. Obriga comunicação formal ao destinatário (item 1.19 TTD).');
      obs.push('Vantagem para o cliente: se credita 10% em vez de 4%.');
      break;
    case 'B7':
      obs.push('Pessoa física consumidor final — ICMS integral, SEM crédito presumido.');
      break;
    case 'B9':
      obs.push('Destinatário com TTD/diferimento (Pró-Emprego) — CP vedado (art. 246, §6º, IV).');
      break;
    case 'B10':
      obs.push('Destinatário têxtil/confecções (art. 15, XXXIX) — obrigatório 10%.');
      break;
    case 'B11':
      obs.push('CD Exclusivo (Booster) — enviar comunicação ao CD (estorno + declaração anual).');
      break;
    case 'B12':
      obs.push('Transferência interna para filial SC — diferido, sem CP.');
      break;
    case 'A8':
      obs.push('Cobre/Aço — carga efetiva 0,6% (não 1,0%).');
      break;
    case 'A9':
      obs.push('Transferência interestadual — equivale a comercialização (art. 246, §17). CP se aplica.');
      break;
    case 'DEVOLUCAO':
      obs.push('Devolução — estornar CP (item 1.20 TTD). Fundos: creditar via DCIP 54.');
      break;
    case 'DESCONHECIDO':
      obs.push('Cenário não identificado — verificar manualmente.');
      break;
  }

  // Alertas gerais
  if (cenarioId !== 'B7' && cenarioId !== 'B9' && cenarioId !== 'B12' && cenarioId !== 'DESCONHECIDO') {
    obs.push('Fundos 0,4% sobre BC integral (FUMDES + FIA — Portaria SEF 143/2022).');
  }

  // CAMEX
  if (['A2', 'A5', 'A7', 'B2', 'B4-CAMEX', 'B5-CAMEX', 'B6-CAMEX'].includes(cenarioId)) {
    obs.push('NCM sem similar nacional (CAMEX) — alíquota interestadual 12% ou 7% conforme UF.');
  }

  // Alerta para SN sem ST interno
  if (cenarioId === 'B5' || cenarioId === 'B5-CAMEX') {
    obs.push('SN sem ST: destaque com alíquota interna (12%/17%). Sem diferimento parcial.');
  }

  // Industrial com 4%
  if (cenarioId === 'B1' && params.destCnpj) {
    obs.push('Se destinatário é industrial, considerar opção 10% (cenário B3) — mais crédito para o cliente.');
  }

  return obs;
}

// ── Escolher alíquota default ───────────────────────────────────

function escolherAliquotaDefault(cenario: CenarioConfig, destUf: string, config: AppConfig): number {
  if (cenario.aliquotasAceitas.length === 0) return 0;
  if (cenario.aliquotasAceitas.length === 1) return cenario.aliquotasAceitas[0];

  // Para cenários CAMEX interestaduais: usar alíquota conforme UF destino
  if (['A2', 'A5', 'A7'].includes(cenario.id)) {
    const ufUpper = destUf.toUpperCase();
    if (config.ufAliquotas[ufUpper]) return config.ufAliquotas[ufUpper];
    // Default: 7% para N/NE/CO/ES, 12% para S/SE
    const ufs12 = ['PR', 'RJ', 'RS', 'SP'];
    return ufs12.includes(ufUpper) ? 12 : 7;
  }

  // B3 (industrial): default 10% (é a opção que beneficia o cliente)
  if (cenario.id === 'B3') return 10;

  // Cenários com alíquota interna: default 17%
  if (cenario.aliquotasAceitas.includes(17)) return 17;

  return cenario.aliquotasAceitas[0];
}

// ── Simulador principal ─────────────────────────────────────────

// ── Verificar vedação por NCM (Decreto 2.128) ─────────────────

function verificarVedacaoNCM(ncm: string, config: AppConfig): string | null {
  const normalized = ncm.replace(/\./g, '');
  for (const prefix of config.decreto2128) {
    const normalizedPrefix = prefix.replace(/\./g, '');
    if (normalized.startsWith(normalizedPrefix)) {
      return `NCM ${ncm} vedada pelo Decreto 2.128/SC. TTD 410 NAO pode ser aplicado.`;
    }
  }
  return null;
}

export function simular(params: SimuladorParams, config: AppConfig): SimuladorResult {
  // Check vedacao BEFORE classifying cenario
  const vedacaoMsg = verificarVedacaoNCM(params.ncm, config);
  const isVedado = vedacaoMsg !== null;

  const cenarioId = classificarCenarioSimulador(params, config);
  const cenario = CENARIOS[cenarioId];

  // Cenário não mapeado (DEVOLUCAO, DESCONHECIDO)
  if (!cenario) {
    return {
      aliquotaDestacada: 0,
      icmsDestacado: 0,
      icmsRecolhimento: { valor: 0, pct: 0 },
      fundosSociais: { valor: 0, pct: 0 },
      totalRecolher: { valor: 0, pct: 0 },
      creditoPresumido: 0,
      cenarioClassificado: cenarioId,
      cenarioNome: cenarioId === 'DEVOLUCAO'
        ? 'Devolução — estornar CP'
        : 'Cenário não identificado',
      refTTD: '',
      observacoes: gerarObservacoes(cenarioId, params),
      bcIntegral: params.valorOperacao,
      ncm: params.ncm,
      isVedado,
      vedacaoMsg: vedacaoMsg ?? '',
    };
  }

  const aliquota = escolherAliquotaDefault(cenario, params.destUf, config);

  // Cobre/aço com alíquota 4%: carga efetiva = 0,6% ao invés da padrão do cenário
  const cobreAco = isCobreAco(params.ncm, config.listaCobreAco);
  const cargaEfetivaOverride = (cobreAco && Math.abs(aliquota - 4) < 0.01) ? 0.6 : undefined;

  const calc = calcularTTD(cenario, params.valorOperacao, aliquota, cargaEfetivaOverride);
  const observacoes = gerarObservacoes(cenarioId, params);

  // Add cobre/aco observation
  if (cobreAco && cargaEfetivaOverride !== undefined) {
    observacoes.push('Cobre/Aço — carga efetiva 0,6% (não ' + cenario.cargaEfetiva + '%).');
  }
  const icmsDestacado = Math.round(calc.bcIntegral * calc.aliquotaDestacada) / 100;

  return {
    aliquotaDestacada: calc.aliquotaDestacada,
    icmsDestacado,
    icmsRecolhimento: { valor: calc.icmsRecolhimento, pct: calc.icmsRecolhimentoPct },
    fundosSociais: { valor: calc.fundosSociais, pct: calc.fundosSociaisPct },
    totalRecolher: { valor: calc.totalRecolher, pct: calc.totalRecolherPct },
    creditoPresumido: calc.creditoPresumido,
    cenarioClassificado: cenarioId,
    cenarioNome: cenario.nome,
    refTTD: cenario.refTTD,
    observacoes,
    bcIntegral: calc.bcIntegral,
    ncm: params.ncm,
    isVedado,
    vedacaoMsg: vedacaoMsg ?? '',
  };
}
