import type { ItemData, NfeData } from '../types/nfe.ts';
import type { ValidationResult } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig, VedacaoRule, CondicaoVedacao, CamposDerivados } from '../types/regras.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { computarCamposDerivados } from './classifier.ts';

function getValoresVedacao(rule: VedacaoRule, config: AppConfig): string[] {
  if (rule.fonte === 'inline') return rule.valores ?? [];
  if (rule.fonte === 'config' && rule.campoConfig) {
    return (config as unknown as Record<string, unknown>)[rule.campoConfig] as string[] ?? [];
  }
  return [];
}

function formatMsg(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return result;
}

function avaliarVedacaoNcmPrefix(
  rule: VedacaoRule,
  item: ItemData,
  nfe: NfeData,
  prefixes: string[],
): ValidationResult | null {
  const normalizedNcm = item.ncm.replace(/\./g, '');

  for (const prefix of prefixes) {
    const normalizedPrefix = prefix.replace(/\./g, '');
    if (!normalizedNcm.startsWith(normalizedPrefix)) continue;

    // Checar excecao V01-EXC:
    // Operação interna SC com alíquota cheia (≥10%) — pode indicar uso
    // legítimo do TTD sob autorização específica (ex: apuração mensal de CP),
    // ou simplesmente que a empresa não aplicou TTD naquele item.
    // Nos dois casos, AVISO é mais adequado que ERRO bloqueante, pois o sistema
    // não consegue distinguir autorização específica de uso indevido.
    if (rule.excecao) {
      const isInternaSC = nfe.emitUF === 'SC' && nfe.dest.uf === 'SC';
      const aliquotaCheia = item.pICMS >= 10;

      if (isInternaSC && aliquotaCheia) {
        return {
          status: 'AVISO',
          mensagem: formatMsg(rule.excecao.mensagemAlerta, { ncm: item.ncm, aliq: String(item.pICMS) }),
          regra: rule.excecao.regraExcecao,
        };
      }
    }

    return {
      status: 'ERRO',
      mensagem: formatMsg(rule.mensagemErro, { ncm: item.ncm }),
      regra: rule.regra,
    };
  }

  return null;
}

function avaliarVedacaoCfopExato(
  rule: VedacaoRule,
  item: ItemData,
  cfops: string[],
): ValidationResult | null {
  if (cfops.includes(item.cfop)) {
    return {
      status: 'ERRO',
      mensagem: rule.mensagemErro,
      regra: rule.regra,
    };
  }
  return null;
}

function matchCondicaoVedacao(cond: CondicaoVedacao, derivados: CamposDerivados): boolean {
  if (cond.operacao !== undefined && cond.operacao !== derivados.operacao) return false;
  if (cond.cfopMatch !== undefined && cond.cfopMatch !== derivados.cfopMatch) return false;
  if (cond.tipoDest !== undefined && cond.tipoDest.length > 0) {
    if (!cond.tipoDest.includes(derivados.tipoDest)) return false;
  }
  if (cond.listaEspecial !== undefined && cond.listaEspecial !== derivados.listaEspecial) return false;
  return true;
}

function avaliarVedacaoCondicao(
  rule: VedacaoRule,
  item: ItemData,
  nfe: NfeData,
  config: AppConfig,
  regras: RegrasConfig,
): ValidationResult | null {
  if (!rule.condicaoVedacao) return null;
  const derivados = computarCamposDerivados(item, nfe.dest, config, regras);
  if (matchCondicaoVedacao(rule.condicaoVedacao, derivados)) {
    return {
      status: 'ERRO',
      mensagem: rule.mensagemErro,
      regra: rule.regra,
    };
  }
  return null;
}

let _defaultRegras: RegrasConfig | null = null;
function getDefaults(): RegrasConfig {
  if (!_defaultRegras) _defaultRegras = getDefaultRegras();
  return _defaultRegras;
}

export function verificarVedacoes(
  item: ItemData,
  nfe: NfeData,
  config: AppConfig,
  regras?: RegrasConfig,
): ValidationResult[] {
  const r = regras ?? getDefaults();
  const results: ValidationResult[] = [];

  for (const rule of r.vedacoes) {
    if (!rule.ativo) continue;

    const valores = getValoresVedacao(rule, config);

    let result: ValidationResult | null = null;
    if (rule.tipo === 'ncm_prefix') {
      result = avaliarVedacaoNcmPrefix(rule, item, nfe, valores);
    } else if (rule.tipo === 'cfop_exato') {
      result = avaliarVedacaoCfopExato(rule, item, valores);
    } else if (rule.tipo === 'condicao_operacao') {
      result = avaliarVedacaoCondicao(rule, item, nfe, config, r);
    }

    if (result) {
      results.push(result);
    }
  }

  return results;
}
