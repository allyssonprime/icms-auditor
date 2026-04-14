import type { CenarioConfig } from '../types/cenario.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig, CamposDerivados, TipoDest, ListaEspecial } from '../types/regras.ts';
import type { ItemData, NfeData } from '../types/nfe.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { verificarVedacoes } from '../engine/vedacoes.ts';
import { resolverCenario } from '../engine/classifier.ts';
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

// ── Converter SimuladorParams em CamposDerivados ─────────────────

function buildCamposDerivadosSimulador(
  params: SimuladorParams,
  config: AppConfig,
): CamposDerivados {
  const isInterestadual = params.destUf.toUpperCase() !== 'SC';
  const isPF = params.isPessoaFisica === true;
  const isNaoContrib = !isPF && params.destRegime === 'nao_contribuinte';
  const isSN = params.destRegime === 'simples_nacional';
  const isContrib = params.destRegime === 'normal';

  let tipoDest: TipoDest = 'desconhecido';
  if (isPF) tipoDest = 'pf';
  else if (isNaoContrib) tipoDest = 'pj_nc';
  else if (isSN) tipoDest = 'sn';
  else if (isContrib) tipoDest = 'contribuinte';

  const normalizedNcm = params.ncm.replace(/\./g, '');
  const isCAMEX = params.isCamex === true ||
    params.cstOrigem === '6' ||
    config.listaCamex.some(ncm => {
      const camexNorm = ncm.replace(/\./g, '');
      return normalizedNcm.startsWith(camexNorm);
    });
  const temST = params.temST === true;

  let listaEspecial: ListaEspecial | null = null;
  if (params.destCnpj) {
    if (config.listaVedacao25a.includes(params.destCnpj)) listaEspecial = 'vedacao25a';
    else if (config.listaVedacao25b.includes(params.destCnpj)) listaEspecial = 'vedacao25b';
    else if (config.listaCD.includes(params.destCnpj)) listaEspecial = 'cd';
    else if (
      params.isIndustrial === true ||
      (params.isIndustrial !== false && config.listaIndustriais.includes(params.destCnpj))
    ) listaEspecial = 'industrial';
  }

  return {
    operacao: isInterestadual ? 'interestadual' : 'interna',
    tipoDest,
    isCAMEX,
    isCobreAco: isCobreAco(params.ncm, config.listaCobreAco),
    temST,
    cfopMatch: null,
    listaEspecial,
    aplicacao: params.aplicacao ?? null,
  };
}

// ── Observações por cenário ─────────────────────────────────────

function gerarObservacoes(
  cenarioId: string,
  params: SimuladorParams,
  derivados: CamposDerivados,
  cenario: CenarioConfig | undefined,
): string[] {
  const obs: string[] = [];
  const cfg = cenario; // alias preserves original body without renaming every cfg reference

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

  if (cfg && cfg.fundos > 0) {
    obs.push('Fundos 0,4% sobre BC integral (FUMDES + FIA — Portaria SEF 143/2022).');
  }

  if (derivados.isCAMEX && derivados.operacao === 'interestadual') {
    obs.push('NCM sem similar nacional (CAMEX) — alíquota interestadual 12% ou 7% conforme UF.');
  }

  if (cenarioId === 'B5' || cenarioId === 'B5-CAMEX') {
    obs.push('SN sem ST: destaque com alíquota interna (12%/17%). Sem diferimento parcial.');
  }

  if (cenarioId === 'B1' && params.destCnpj) {
    obs.push('Se destinatário é industrial, considerar opção 10% (cenário B3) — mais crédito para o cliente.');
  }

  return obs;
}

// ── Escolher alíquota default ───────────────────────────────────

function escolherAliquotaDefault(
  cenario: CenarioConfig,
  destUf: string,
  config: AppConfig,
  derivados: CamposDerivados,
): number {
  if (cenario.aliquotasAceitas.length === 0) return 0;
  if (cenario.aliquotasAceitas.length === 1) return cenario.aliquotasAceitas[0];

  // CAMEX interestadual com múltiplas alíquotas: usar alíquota conforme UF destino
  if (derivados.isCAMEX && derivados.operacao === 'interestadual') {
    const ufUpper = destUf.toUpperCase();
    if (config.ufAliquotas[ufUpper]) return config.ufAliquotas[ufUpper];
    const ufs12 = ['PR', 'RJ', 'RS', 'SP'];
    return ufs12.includes(ufUpper) ? 12 : 7;
  }

  // Industrial com múltiplas alíquotas: default é a maior (beneficia o cliente)
  if (derivados.listaEspecial === 'industrial' && cenario.aliquotasAceitas.length > 1) {
    return Math.max(...cenario.aliquotasAceitas);
  }

  // Cenários com alíquota interna: default 17%
  if (cenario.aliquotasAceitas.includes(17)) return 17;

  return cenario.aliquotasAceitas[0];
}

// ── Simulador principal ─────────────────────────────────────────

export function simular(params: SimuladorParams, config: AppConfig, regras: RegrasConfig): SimuladorResult {
  const itemShim = {
    ncm: params.ncm,
    cfop: '',
    pICMS: 0,
    cCredPresumido: '',
    cst: params.temST ? '010' : '000',
    cstOrig: params.cstOrigem ?? '1',
  } as ItemData;
  const nfeShim = {
    emitUF: 'SC',
    dest: {
      uf: params.destUf,
      cnpj: params.destCnpj ?? '',
      cpf: params.isPessoaFisica ? 'PF' : '',
      indIEDest: params.destRegime === 'normal' ? '1' : '9',
      ie: params.destRegime === 'normal' ? 'ACTIVE' : '',
    },
  } as NfeData;

  const vedacaoResults = verificarVedacoes(itemShim, nfeShim, config, regras);
  const isVedado = vedacaoResults.some(v => v.status === 'ERRO');
  const vedacaoMsg = vedacaoResults.map(v => v.mensagem).join(' | ');

  const derivados = buildCamposDerivadosSimulador(params, config);
  const resolvido = resolverCenario(regras.grupos, derivados);
  const cenarioId = resolvido?.cenarioId ?? 'DESCONHECIDO';
  // Usa resolvido.config (config da branch que efetivamente bateu), não cenarios[cenarioId]
  // (getCenarios sobrescreve com a última branch de mesmo cenarioId, ignorando a branch vencedora)
  const cenario = resolvido?.config;

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
      observacoes: gerarObservacoes(cenarioId, params, derivados, undefined),
      bcIntegral: params.valorOperacao,
      ncm: params.ncm,
      isVedado,
      vedacaoMsg: vedacaoMsg ?? '',
    };
  }

  const aliquota = escolherAliquotaDefault(cenario, params.destUf, config, derivados);

  const cobreAco = derivados.isCobreAco;
  const cargaEfetivaOverride = (cobreAco && Math.abs(aliquota - 4) < 0.01) ? 0.6 : undefined;

  const calc = calcularTTD(cenario, params.valorOperacao, aliquota, cargaEfetivaOverride);
  const observacoes = gerarObservacoes(cenarioId, params, derivados, cenario);

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
