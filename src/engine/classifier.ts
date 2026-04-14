import type { ItemData, DestData } from '../types/nfe.ts';
import type { AppConfig } from '../types/config.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { CnpjInfo } from '../types/validation.ts';
import {
  mergeValores,
  type RegrasConfig,
  type CamposDerivados,
  type CondicoesCenario,
  type GrupoRegra,
  type TipoDest,
  type CfopMatch,
  type ListaEspecial,
  type AplicacaoProduto,
  type ValoresEsperados,
} from '../types/regras.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { isNaoContribuinte } from './aliquota.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';

// --- Computar campos derivados da NF-e ---

export function computarCamposDerivados(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
  regras: RegrasConfig,
  aplicacao?: AplicacaoProduto | null,
  cnpjInfoMap?: Map<string, CnpjInfo>,
): CamposDerivados {
  const isInterestadual = dest.uf.toUpperCase() !== 'SC';

  // tipoDest com prioridade: pf > pj_nc > sn > contribuinte
  const isPF = !!dest.cpf && !dest.cnpj;
  const isPJNaoContribuinte = !isPF && isNaoContribuinte(dest);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isContribuinte = dest.indIEDest === '1';

  let tipoDest: TipoDest = 'desconhecido';
  if (isPF) tipoDest = 'pf';
  else if (isPJNaoContribuinte) tipoDest = 'pj_nc';
  else if (isSN) tipoDest = 'sn';
  else if (isContribuinte) tipoDest = 'contribuinte';

  // CAMEX
  const normalizedNcm = item.ncm.replace(/\./g, '');
  const isCAMEX = item.cstOrig === '6' || config.listaCamex.some(ncm => {
    const camexNorm = ncm.replace(/\./g, '');
    return normalizedNcm.startsWith(camexNorm);
  });

  // Cobre/Aco
  const isCobreAcoFlag = isCobreAco(item.ncm, config.listaCobreAco);

  // ST
  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;
  const temST = ['10', '30', '60', '70'].includes(cstTrib);

  // cfopMatch
  let cfopMatch: CfopMatch | null = null;
  if (regras.global.cfopsDevolucao.includes(item.cfop)) cfopMatch = 'devolucao';
  else if (regras.global.cfopsTransferencia.includes(item.cfop)) cfopMatch = 'transferencia';

  // listaEspecial
  let listaEspecial: ListaEspecial | null = null;
  if (dest.cnpj) {
    if (config.listaVedacao25a.includes(dest.cnpj)) listaEspecial = 'vedacao25a';
    else if (config.listaVedacao25b.includes(dest.cnpj)) listaEspecial = 'vedacao25b';
    else if (config.listaCD.includes(dest.cnpj)) listaEspecial = 'cd';
    else if (config.listaIndustriais.includes(dest.cnpj)) listaEspecial = 'industrial';
    else if (cnpjInfoMap) {
      // Fallback: CNAE industrial via CNPJá (marca como industrial para cair em B3 em vez de B1)
      const info = cnpjInfoMap.get(dest.cnpj.replace(/\D/g, ''));
      if (info?.isIndustrial) listaEspecial = 'industrial';
    }
  }

  return {
    operacao: isInterestadual ? 'interestadual' : 'interna',
    tipoDest,
    isCAMEX,
    isCobreAco: isCobreAcoFlag,
    temST,
    cfopMatch,
    listaEspecial,
    aplicacao: aplicacao ?? null,
  };
}

// --- Match de condicoes ---

function matchCondicoes(condicoes: Partial<CondicoesCenario>, derivados: CamposDerivados): boolean {
  if (condicoes.operacao !== undefined && condicoes.operacao !== derivados.operacao) return false;

  if (condicoes.tipoDest !== undefined && condicoes.tipoDest.length > 0) {
    if (!condicoes.tipoDest.includes(derivados.tipoDest)) return false;
  }

  if (condicoes.camex !== undefined && condicoes.camex !== derivados.isCAMEX) return false;
  if (condicoes.cobreAco !== undefined && condicoes.cobreAco !== derivados.isCobreAco) return false;
  if (condicoes.temST !== undefined && condicoes.temST !== derivados.temST) return false;

  if (condicoes.listaEspecial !== undefined) {
    if (condicoes.listaEspecial !== derivados.listaEspecial) return false;
  }

  if (condicoes.cfopMatch !== undefined) {
    if (condicoes.cfopMatch !== derivados.cfopMatch) return false;
  }

  // aplicacao: branch com aplicacao definida só bate quando aplicacao é conhecida
  // Se derivados.aplicacao=null (auditoria), branch específica de aplicacao não bate —
  // o auditor não tem essa informação e deve usar a branch catch-all (sem aplicacao)
  if (condicoes.aplicacao !== undefined) {
    if (derivados.aplicacao === null) return false;
    if (condicoes.aplicacao !== derivados.aplicacao) return false;
  }

  return true;
}

// --- Resolver cenario a partir dos grupos ---

export interface CenarioResolvido {
  cenarioId: string;
  config: CenarioConfig;
}


function valoresToCenarioConfig(cenarioId: string, nome: string, valores: ValoresEsperados): CenarioConfig {
  return {
    id: cenarioId,
    nome,
    aliquotasAceitas: valores.aliquotasAceitas,
    cargaEfetiva: valores.cargaEfetiva,
    fundos: valores.fundos,
    cstEsperado: valores.cstEsperado,
    cfopsEsperados: valores.cfopsEsperados,
    temCP: valores.temCP,
    temDiferimentoParcial: valores.temDiferimentoParcial,
    refTTD: valores.refTTD,
  };
}

export function resolverCenario(
  grupos: GrupoRegra[],
  derivados: CamposDerivados,
): CenarioResolvido | null {
  const gruposOrdenados = [...grupos]
    .filter(g => g.ativo)
    .sort((a, b) => a.prioridade - b.prioridade);

  for (const grupo of gruposOrdenados) {
    if (!matchCondicoes(grupo.condicoes, derivados)) continue;

    const ramsOrdenadas = [...grupo.ramificacoes].sort((a, b) => {
      const prioDiff = a.prioridade - b.prioridade;
      if (prioDiff !== 0) return prioDiff;
      // Desempate por especificidade: mais condições definidas = avaliada primeiro
      const aSpec = Object.values(a.condicaoExtra ?? {}).filter(v => v !== undefined).length;
      const bSpec = Object.values(b.condicaoExtra ?? {}).filter(v => v !== undefined).length;
      return bSpec - aSpec;
    });

    for (const ram of ramsOrdenadas) {
      if (ram.condicaoExtra && !matchCondicoes(ram.condicaoExtra, derivados)) continue;

      const valores = mergeValores(grupo.valoresBase, ram.override);
      return {
        cenarioId: ram.cenarioId,
        config: valoresToCenarioConfig(ram.cenarioId, ram.nome, valores),
      };
    }
  }

  return null;
}

// --- Funcao principal (compativel com assinatura anterior) ---

let _defaultRegras: RegrasConfig | null = null;
function getDefaults(): RegrasConfig {
  if (!_defaultRegras) _defaultRegras = getDefaultRegras();
  return _defaultRegras;
}

export function classificarCenario(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
  regras?: RegrasConfig,
  aplicacao?: AplicacaoProduto | null,
  cnpjInfoMap?: Map<string, CnpjInfo>,
): string {
  try {
    const r = regras ?? getDefaults();
    const derivados = computarCamposDerivados(item, dest, config, r, aplicacao, cnpjInfoMap);

    // DEVOLUCAO: tratamento especial, nao configuravel
    if (derivados.cfopMatch === 'devolucao') return 'DEVOLUCAO';

    const resultado = resolverCenario(r.grupos, derivados);
    return resultado ? resultado.cenarioId : 'DESCONHECIDO';
  } catch {
    return 'DESCONHECIDO';
  }
}
