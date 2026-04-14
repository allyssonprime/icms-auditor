import type { ItemData, DestData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult, CrossCheck, CrossCheckSeverity, CnpjInfo } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { getAliquotaInterestadual } from '../data/ufAliquotas.ts';

export interface AliquotaResult {
  result: ValidationResult;
  crossChecks: CrossCheck[];
}

/** Não-contribuinte: indIEDest=9 OU IE ausente/ISENTA/ISENTO */
export function isNaoContribuinte(dest: DestData): boolean {
  if (dest.indIEDest === '9') return true;
  if (!dest.ie || dest.ie.trim() === '') return true;
  const ieUpper = dest.ie.toUpperCase().trim();
  return ieUpper === 'ISENTA' || ieUpper === 'ISENTO';
}

function isCAMEXByOrigin(item: ItemData): boolean {
  return item.cstOrig === '6';
}

function isCAMEXByNCM(item: ItemData, config: AppConfig): boolean {
  const normalizedNcm = item.ncm.replace(/\./g, '');
  return config.listaCamex.some(ncm => {
    const camexNorm = ncm.replace(/\./g, '');
    return normalizedNcm.startsWith(camexNorm);
  });
}

function isBCReduzida(item: ItemData): boolean {
  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;
  if (cstTrib === '20') return true;
  if (item.pRedBC > 0) return true;
  if (item.vProd > 0 && item.vBC > 0 && item.vBC < item.vProd * 0.98) return true;
  return false;
}

// Helpers para lógica OR com 3 níveis de severidade
function assignOrSeverity(passed: boolean, anyOrPassed: boolean): CrossCheckSeverity {
  if (passed) return 'ok';
  return anyOrPassed ? 'atencao' : 'divergente';
}

function assignMandatorySeverity(passed: boolean): CrossCheckSeverity {
  return passed ? 'ok' : 'divergente';
}

// ----- Cross-checks por aliquota -----

function crossChecks12(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const camexOrig = isCAMEXByOrigin(item);
  const camexNCM = isCAMEXByNCM(item, config);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = isNaoContribuinte(dest);

  // OR: CST 6 | NCM CAMEX | SN
  const anyOrPassed = camexOrig || camexNCM || isSN;
  // Mandatory: NOT NC
  const mandatoryOk = !isNC;

  const checks: CrossCheck[] = [
    { label: 'CST origem = 6 (CAMEX)?', severity: assignOrSeverity(camexOrig, anyOrPassed), passed: camexOrig, regra: 'CK12A' },
    { label: 'NCM na lista CAMEX?', severity: assignOrSeverity(camexNCM, anyOrPassed), passed: camexNCM, regra: 'CK12B' },
    { label: 'Destinatário é Simples Nacional?', severity: assignOrSeverity(isSN, anyOrPassed), passed: isSN, regra: 'CK12C' },
    { label: 'Destinatário NÃO é não-contribuinte?', severity: assignMandatorySeverity(mandatoryOk), passed: mandatoryOk, regra: 'CK12D' },
  ];

  const hasJustification = mandatoryOk && anyOrPassed;
  return { checks, hasJustification };
}

function crossChecks10(
  _item: ItemData,
  dest: DestData,
  config: AppConfig,
  cenario: CenarioConfig,
  cnpjInfoMap?: Map<string, CnpjInfo>,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const isInterna = dest.uf.toUpperCase() === 'SC';
  const isIndustrial = !!dest.cnpj && config.listaIndustriais.includes(dest.cnpj);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = isNaoContribuinte(dest);

  // CK10E: CNAE de atividade industrial (da CNPJa)
  let cnaeIndustrial = false;
  if (dest.cnpj && cnpjInfoMap) {
    const info = cnpjInfoMap.get(dest.cnpj.replace(/\D/g, ''));
    if (info) cnaeIndustrial = info.isIndustrial;
  }

  // OR para cenários industriais que aceitam 4% OU 10%: industrial lista OU CNAE industrial
  const isIndustrialScenario = cenario.aliquotasAceitas.includes(4) && cenario.aliquotasAceitas.includes(10);
  const anyOrPassed = isIndustrialScenario ? (isIndustrial || cnaeIndustrial) : true;

  // Mandatory: interna, NOT SN, NOT NC
  const checks: CrossCheck[] = [
    { label: 'Remessa interna (SC para SC)?', severity: assignMandatorySeverity(isInterna), passed: isInterna, regra: 'CK10A' },
    { label: 'Dest. na lista de industriais?', severity: isIndustrialScenario ? assignOrSeverity(isIndustrial, anyOrPassed) : assignMandatorySeverity(isIndustrial), passed: isIndustrial, regra: 'CK10B' },
    { label: 'CNAE de atividade industrial?', severity: isIndustrialScenario ? assignOrSeverity(cnaeIndustrial, anyOrPassed) : assignOrSeverity(cnaeIndustrial, cnaeIndustrial), passed: cnaeIndustrial, regra: 'CK10E' },
    { label: 'Dest. NÃO é optante do Simples Nacional?', severity: assignMandatorySeverity(!isSN), passed: !isSN, regra: 'CK10C' },
    { label: 'Dest. NÃO é não-contribuinte?', severity: assignMandatorySeverity(!isNC), passed: !isNC, regra: 'CK10D' },
  ];

  const mandatoryOk = isInterna && !isSN && !isNC;
  const hasJustification = isIndustrialScenario
    ? (mandatoryOk && anyOrPassed)
    : (mandatoryOk);

  return { checks, hasJustification };
}

function crossChecks04(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
  cenario: CenarioConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const cstOrig6 = item.cstOrig === '6';
  const cstOrig1 = item.cstOrig === '1';
  const isB4 = cenario.cstEsperado.some(c => c === '10' || c === '70') && cenario.aliquotasAceitas.some(a => Math.abs(a - 4) < 0.01);

  // SN a 4% é valido para: B4 (SN com ST interna) ou interestadual (E01)
  const isInterestadual = dest.uf.toUpperCase() !== 'SC';
  const snOk = isB4 || isInterestadual || !isSN;

  const checks: CrossCheck[] = [
    { label: 'Dest. NÃO é optante do Simples Nacional?', severity: assignMandatorySeverity(snOk), passed: snOk, regra: 'CK04A' },
    { label: 'CST origem ≠ 6 (deveria ser 12%)?', severity: assignMandatorySeverity(!cstOrig6), passed: !cstOrig6, regra: 'CK04B' },
    { label: 'CST origem = 1 (importado com similar)?', severity: assignMandatorySeverity(cstOrig1), passed: cstOrig1, regra: 'CK04C' },
  ];

  const hasJustification = snOk && !cstOrig6 && cstOrig1;
  return { checks, hasJustification };
}

function crossChecks17(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
): { checks: CrossCheck[]; hasJustification: boolean; snOnly: boolean } {
  const bcReduzida = isBCReduzida(item);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = isNaoContribuinte(dest);

  // OR: BC reduzida | SN (fraco) | NC
  const anyOrPassed = bcReduzida || isSN || isNC;
  // SN sozinho como única justificativa → atenção
  const snOnly = !bcReduzida && !isNC && isSN;

  const checks: CrossCheck[] = [
    { label: 'Base de cálculo é reduzida?', severity: assignOrSeverity(bcReduzida, anyOrPassed), passed: bcReduzida, regra: 'CK17A' },
    { label: 'Destinatário é Simples Nacional?', severity: snOnly ? 'atencao' : assignOrSeverity(isSN, anyOrPassed), passed: isSN, regra: 'CK17B' },
    { label: 'Destinatário é não-contribuinte?', severity: assignOrSeverity(isNC, anyOrPassed), passed: isNC, regra: 'CK17C' },
  ];

  const hasJustification = anyOrPassed;
  return { checks, hasJustification, snOnly };
}

function crossChecks07(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
  regras: RegrasConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const camexOrig = isCAMEXByOrigin(item);
  const camexNCM = isCAMEXByNCM(item, config);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  // UF destino tem 7% como alíquota interestadual nominal (N/NE/CO/ES)
  const ufRate = resolveUfAliquota(dest.uf, regras);
  const uf7 = Math.abs(ufRate - 7) < 0.01;

  // OR: CAMEX (origem ou NCM) | SN | UF com 7% nominal
  const anyOrPassed = camexOrig || camexNCM || isSN || uf7;

  const checks: CrossCheck[] = [
    { label: 'UF destino com alíquota 7% (N/NE/CO/ES)?', severity: assignOrSeverity(uf7, anyOrPassed), passed: uf7, regra: 'CK07A' },
    { label: 'CST origem = 6 (CAMEX)?', severity: assignOrSeverity(camexOrig, anyOrPassed), passed: camexOrig, regra: 'CK07B' },
    { label: 'NCM na lista CAMEX?', severity: assignOrSeverity(camexNCM, anyOrPassed), passed: camexNCM, regra: 'CK07C' },
    { label: 'Destinatário é Simples Nacional?', severity: assignOrSeverity(isSN, anyOrPassed), passed: isSN, regra: 'CK07D' },
  ];

  return { checks, hasJustification: anyOrPassed };
}

function crossChecks25(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
  cenario: CenarioConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = isNaoContribuinte(dest);
  const bcReduzida = isBCReduzida(item);
  // 25% é a alíquota de supérfluos em SC. Cenário que a aceita
  // explicitamente também é justificativa.
  const cenarioAceita25 = cenario.aliquotasAceitas.some(a => Math.abs(a - 25) < 0.01);

  // OR: cenário aceita 25% | SN | NC | BC reduzida
  const anyOrPassed = cenarioAceita25 || isSN || isNC || bcReduzida;

  const checks: CrossCheck[] = [
    { label: 'Cenário aceita 25% (supérfluos)?', severity: assignOrSeverity(cenarioAceita25, anyOrPassed), passed: cenarioAceita25, regra: 'CK25A' },
    { label: 'Destinatário é Simples Nacional?', severity: assignOrSeverity(isSN, anyOrPassed), passed: isSN, regra: 'CK25B' },
    { label: 'Destinatário é não-contribuinte?', severity: assignOrSeverity(isNC, anyOrPassed), passed: isNC, regra: 'CK25C' },
    { label: 'Base de cálculo reduzida?', severity: assignOrSeverity(bcReduzida, anyOrPassed), passed: bcReduzida, regra: 'CK25D' },
  ];

  return { checks, hasJustification: anyOrPassed };
}

function crossChecks880(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
  cenario: CenarioConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const bcReduzida = isBCReduzida(item);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const cenarioAceita880 = cenario.aliquotasAceitas.some(a => Math.abs(a - 8.8) < 0.01);
  // Alíquota 8,80% == 17% sobre BC reduzida ~48,24% (ou 8,80% nominal em cenário específico)
  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;
  const cstReducao = cstTrib === '20';

  // OR: cenário aceita 8,80 | BC reduzida | CST 20 | SN
  const anyOrPassed = cenarioAceita880 || bcReduzida || cstReducao || isSN;

  const checks: CrossCheck[] = [
    { label: 'Cenário aceita 8,80%?', severity: assignOrSeverity(cenarioAceita880, anyOrPassed), passed: cenarioAceita880, regra: 'CK88A' },
    { label: 'Base de cálculo reduzida declarada?', severity: assignOrSeverity(bcReduzida, anyOrPassed), passed: bcReduzida, regra: 'CK88B' },
    { label: 'CST tributação 20 (redução formal)?', severity: assignOrSeverity(cstReducao, anyOrPassed), passed: cstReducao, regra: 'CK88C' },
    { label: 'Destinatário é Simples Nacional?', severity: assignOrSeverity(isSN, anyOrPassed), passed: isSN, regra: 'CK88D' },
  ];

  return { checks, hasJustification: anyOrPassed };
}

// ----- Função principal -----

let _defaultRegras: RegrasConfig | null = null;
function getDefaults(): RegrasConfig {
  if (!_defaultRegras) _defaultRegras = getDefaultRegras();
  return _defaultRegras;
}

function resolveUfAliquota(uf: string, regras: RegrasConfig): number {
  const ufUpper = uf.toUpperCase();
  const custom = regras.global.ufAliquotas[ufUpper];
  if (custom !== undefined) return custom;
  // Fallback para funcao original
  return getAliquotaInterestadual(uf);
}

export function validarAliquota(
  item: ItemData,
  cenario: CenarioConfig,
  dest: DestData,
  config: AppConfig,
  cnpjInfoMap?: Map<string, CnpjInfo>,
  regras?: RegrasConfig,
): AliquotaResult {
  const r = regras ?? getDefaults();
  const found = item.pICMS;

  if (cenario.aliquotasAceitas.length === 0) {
    return {
      result: {
        status: 'OK',
        mensagem: `Cenario ${cenario.id}: aliquota nao validada (diferimento/transferencia).`,
        regra: 'AL00',
        cenario: cenario.id,
      },
      crossChecks: [],
    };
  }

  const isIndustrialScenario = cenario.aliquotasAceitas.includes(4) && cenario.aliquotasAceitas.includes(10);

  let aceitas = cenario.aliquotasAceitas;
  if (cenario.isCAMEX === true && cenario.aliquotasAceitas.length > 1) {
    // Narrowing só para interestadual (escolher 12% ou 7% por UF destino).
    // Cenários internos CAMEX aceitam todas as alíquotas listadas.
    const isInterna = dest.uf.toUpperCase() === 'SC';
    if (!isInterna) {
      const expected = resolveUfAliquota(dest.uf, r);
      aceitas = [expected];
    }
  }

  // B3: 4% valido mas 10% com mais credito
  if (isIndustrialScenario && Math.abs(found - 4) < 0.01) {
    return {
      result: {
        status: 'INFO',
        mensagem: 'Aliquota 4% valida, mas opcao 10% disponivel (mais credito para o cliente).',
        regra: 'AL06',
        cenario: cenario.id,
        acao: { tipo: 'nenhuma', prioridade: 'baixa' },
      },
      crossChecks: crossChecks04(item, dest, config, cenario).checks,
    };
  }

  const matches = aceitas.some(a => Math.abs(a - found) < 0.01);

  if (matches) {
    let crossResult: { checks: CrossCheck[]; hasJustification: boolean; snOnly?: boolean } | null = null;

    if (Math.abs(found - 12) < 0.01) {
      crossResult = crossChecks12(item, dest, config);
    } else if (Math.abs(found - 10) < 0.01) {
      crossResult = crossChecks10(item, dest, config, cenario, cnpjInfoMap);
    } else if (Math.abs(found - 4) < 0.01) {
      crossResult = crossChecks04(item, dest, config, cenario);
    } else if (Math.abs(found - 17) < 0.01) {
      crossResult = crossChecks17(item, dest, config);
    } else if (Math.abs(found - 7) < 0.01) {
      crossResult = crossChecks07(item, dest, config, r);
    } else if (Math.abs(found - 25) < 0.01) {
      crossResult = crossChecks25(item, dest, config, cenario);
    } else if (Math.abs(found - 8.8) < 0.01) {
      crossResult = crossChecks880(item, dest, config, cenario);
    }

    if (crossResult && !crossResult.hasJustification) {
      return {
        result: {
          status: 'DIVERGENCIA',
          mensagem: `Aliquota ${found}% aceita para cenario ${cenario.id}, mas verificacoes adicionais apresentam divergencias.`,
          regra: 'AL02',
          cenario: cenario.id,
          acao: { tipo: 'verificar_documento', campo: 'Cross-checks', prioridade: 'media' },
        },
        crossChecks: crossResult.checks,
      };
    }

    // 17% com SN como única justificativa → ALERTA
    if (crossResult && crossResult.snOnly) {
      return {
        result: {
          status: 'AVISO',
          mensagem: `Aliquota ${found}% aceita para cenario ${cenario.id}, porem justificativa somente por Simples Nacional (verificar).`,
          regra: 'AL07',
          cenario: cenario.id,
          acao: { tipo: 'verificar_cadastro', campo: 'Simples Nacional', prioridade: 'media' },
        },
        crossChecks: crossResult.checks,
      };
    }

    // 12%+ sem crédito presumido → ALERTA (atenção), apenas quando cenário espera CP
    // Exceção: CST tributação 20 + pRedBC → BC reduzida justifica a alíquota
    const bcReduzidaJustifica = isBCReduzida(item);
    if (found >= 12 && !item.cCredPresumido && cenario.temCP && !bcReduzidaJustifica) {
      return {
        result: {
          status: 'AVISO',
          mensagem: `Alíquota ${found}% conforme cenário ${cenario.id}, porém sem informação de crédito presumido (verificar).`,
          regra: 'AL08',
          cenario: cenario.id,
          acao: { tipo: 'verificar_documento', campo: 'Credito Presumido', prioridade: 'media' },
        },
        crossChecks: crossResult?.checks ?? [],
      };
    }

    return {
      result: {
        status: 'OK',
        mensagem: `Alíquota ${found}% conforme cenário ${cenario.id}.`,
        regra: 'AL01',
        cenario: cenario.id,
      },
      crossChecks: crossResult?.checks ?? [],
    };
  }

  // Aliquota diverge — cross-checks para visibilidade
  let checks: CrossCheck[] = [];
  if (Math.abs(found - 12) < 0.01) {
    checks = crossChecks12(item, dest, config).checks;
  } else if (Math.abs(found - 10) < 0.01) {
    checks = crossChecks10(item, dest, config, cenario, cnpjInfoMap).checks;
  } else if (Math.abs(found - 4) < 0.01) {
    checks = crossChecks04(item, dest, config, cenario).checks;
  } else if (Math.abs(found - 17) < 0.01) {
    checks = crossChecks17(item, dest, config).checks;
  } else if (Math.abs(found - 7) < 0.01) {
    checks = crossChecks07(item, dest, config, r).checks;
  } else if (Math.abs(found - 25) < 0.01) {
    checks = crossChecks25(item, dest, config, cenario).checks;
  } else if (Math.abs(found - 8.8) < 0.01) {
    checks = crossChecks880(item, dest, config, cenario).checks;
  }

  // Sem CP + alíquota 12%+ → empresa não usa TTD, alíquota normal está correta
  if (!item.cCredPresumido && found >= 12) {
    return {
      result: {
        status: 'INFO',
        mensagem: `Alíquota ${found}% diferente do cenário ${cenario.id} (esperado ${aceitas.join('% ou ')}%), porém sem crédito presumido — possível não utilização do TTD.`,
        regra: 'AL09',
        cenario: cenario.id,
        acao: { tipo: 'nenhuma', prioridade: 'baixa' },
      },
      crossChecks: checks,
    };
  }

  // AL10 — Regime alternativo TTD: operação interna SC com alíquota cheia (10%/12%/17%)
  // + CP declarado em cenário que espera alíquota reduzida (4%).
  // Observado em apurações reais SC TTD 409: contribuintes normais optam por
  // destacar alíquota nominal com CP específico em vez da alíquota reduzida 1.2.a.
  // Carga efetiva é derivada corretamente via deriveCargaEfetiva (3,6% para >=7%).
  // A conferência detalhada do CP é feita pelas regras CP01–CP04 (cpValidation.ts).
  const isInterna = dest.uf.toUpperCase() === 'SC';
  if (isInterna && !!item.cCredPresumido && found >= 10 && aceitas.includes(4)) {
    return {
      result: {
        status: 'AVISO',
        mensagem:
          `Alíquota ${found}% destacada com crédito presumido em cenário ${cenario.id} ` +
          `(que espera ${aceitas.join('% ou ')}%) — regime alternativo do TTD. ` +
          `Conferir CP declarado via regras CP01–CP04.`,
        regra: 'AL10',
        cenario: cenario.id,
        acao: { tipo: 'verificar_documento', campo: 'Credito Presumido', prioridade: 'media' },
      },
      crossChecks: checks,
    };
  }

  return {
    result: {
      status: 'ERRO',
      mensagem: `Aliquota ${found}% diverge do esperado para cenario ${cenario.id}. Esperado: ${aceitas.join('% ou ')}%.`,
      regra: 'AL01',
      cenario: cenario.id,
      acao: { tipo: 'corrigir_nfe', campo: 'pICMS', valorAtual: `${found}%`, valorEsperado: `${aceitas.join('% ou ')}%`, prioridade: 'alta' },
    },
    crossChecks: checks,
  };
}
