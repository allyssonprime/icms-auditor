import type { ItemData, DestData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult, CrossCheck, CrossCheckSeverity, CnpjInfo } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { getAliquotaInterestadual } from '../data/ufAliquotas.ts';

export interface AliquotaResult {
  result: ValidationResult;
  crossChecks: CrossCheck[];
}

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

  // OR (para B3): industrial OU CNAE industrial
  const anyOrPassed = cenario.id === 'B3' ? (isIndustrial || cnaeIndustrial) : true;

  // Mandatory: interna, NOT SN, NOT NC
  const notSN = !isSN;
  const notNC = !isNC;
  const checks: CrossCheck[] = [
    { label: 'Remessa interna (SC para SC)?', severity: assignMandatorySeverity(isInterna), passed: isInterna, regra: 'CK10A' },
    { label: 'Dest. na lista de industriais?', severity: cenario.id === 'B3' ? assignOrSeverity(isIndustrial, anyOrPassed) : assignMandatorySeverity(isIndustrial), passed: isIndustrial, regra: 'CK10B' },
    { label: 'CNAE de atividade industrial?', severity: cenario.id === 'B3' ? assignOrSeverity(cnaeIndustrial, anyOrPassed) : assignOrSeverity(cnaeIndustrial, cnaeIndustrial), passed: cnaeIndustrial, regra: 'CK10E' },
    { label: 'Dest. NÃO é optante do Simples Nacional?', severity: assignMandatorySeverity(notSN), passed: notSN, regra: 'CK10C' },
    { label: 'Dest. NÃO é não-contribuinte?', severity: assignMandatorySeverity(notNC), passed: notNC, regra: 'CK10D' },
  ];

  const mandatoryOk = isInterna && !isSN && !isNC;
  const hasJustification = cenario.id === 'B3'
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
  const isB4 = cenario.id === 'B4';

  // All mandatory (AND logic)
  const snOk = isB4 || !isSN;
  const notCstOrig6 = !cstOrig6;

  const checks: CrossCheck[] = [
    { label: 'Dest. NÃO é optante do Simples Nacional?', severity: assignMandatorySeverity(snOk), passed: snOk, regra: 'CK04A' },
    { label: 'CST origem ≠ 6 (deveria ser 12%)?', severity: assignMandatorySeverity(notCstOrig6), passed: notCstOrig6, regra: 'CK04B' },
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

// ----- Função principal -----

export function validarAliquota(
  item: ItemData,
  cenario: CenarioConfig,
  dest: DestData,
  config: AppConfig,
  cnpjInfoMap?: Map<string, CnpjInfo>,
): AliquotaResult {
  const found = item.pICMS;

  if (cenario.aliquotasAceitas.length === 0) {
    return {
      result: {
        status: 'OK',
        mensagem: `Cenário ${cenario.id}: alíquota não validada (diferimento/transferência).`,
        regra: 'AL00',
        cenario: cenario.id,
      },
      crossChecks: [],
    };
  }

  let aceitas = cenario.aliquotasAceitas;
  if (['A2', 'A5', 'A7'].includes(cenario.id)) {
    const expected = getAliquotaInterestadual(dest.uf);
    aceitas = [expected];
  }

  // B3: 4% valido mas 10% com mais credito
  if (cenario.id === 'B3' && Math.abs(found - 4) < 0.01) {
    return {
      result: {
        status: 'ALERTA',
        mensagem: 'Alíquota 4% válida, mas opção 10% disponível (mais crédito para o cliente).',
        regra: 'AL06',
        cenario: cenario.id,
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
    }

    if (crossResult && !crossResult.hasJustification) {
      return {
        result: {
          status: 'ALERTA',
          mensagem: `Alíquota ${found}% aceita para cenário ${cenario.id}, mas verificações adicionais apresentam divergências.`,
          regra: 'AL02',
          cenario: cenario.id,
        },
        crossChecks: crossResult.checks,
      };
    }

    // 17% com SN como única justificativa → ALERTA
    if (crossResult && crossResult.snOnly) {
      return {
        result: {
          status: 'ALERTA',
          mensagem: `Alíquota ${found}% aceita para cenário ${cenario.id}, porém justificativa somente por Simples Nacional (verificar).`,
          regra: 'AL07',
          cenario: cenario.id,
        },
        crossChecks: crossResult.checks,
      };
    }

    // 12%+ sem crédito presumido → ALERTA (atenção), apenas quando cenário espera CP
    if (found >= 12 && !item.cCredPresumido && cenario.temCP) {
      return {
        result: {
          status: 'ALERTA',
          mensagem: `Alíquota ${found}% conforme cenário ${cenario.id}, porém sem informação de crédito presumido (verificar).`,
          regra: 'AL08',
          cenario: cenario.id,
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
  }

  return {
    result: {
      status: 'ERRO',
      mensagem: `Alíquota ${found}% diverge do esperado para cenário ${cenario.id}. Esperado: ${aceitas.join('% ou ')}%.`,
      regra: 'AL01',
      cenario: cenario.id,
    },
    crossChecks: checks,
  };
}
