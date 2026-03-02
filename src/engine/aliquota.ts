import type { ItemData, DestData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult, CrossCheck } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { getAliquotaInterestadual } from '../data/ufAliquotas.ts';

export interface AliquotaResult {
  result: ValidationResult;
  crossChecks: CrossCheck[];
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

// ----- Cross-checks por aliquota -----

function crossChecks12(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const camexOrig = isCAMEXByOrigin(item);
  const camexNCM = isCAMEXByNCM(item, config);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = dest.indIEDest === '9';

  const checks: CrossCheck[] = [
    { label: 'CST origem = 6 (CAMEX)?', ok: camexOrig, regra: 'CK12A' },
    { label: 'NCM na lista CAMEX?', ok: camexNCM, regra: 'CK12B' },
    { label: 'Destinatario e Simples Nacional?', ok: isSN, regra: 'CK12C' },
    { label: 'Destinatario e nao contribuinte?', ok: !isNC, regra: 'CK12D' },
  ];

  const hasJustification = camexOrig || camexNCM || isSN;
  return { checks, hasJustification };
}

function crossChecks10(
  _item: ItemData,
  dest: DestData,
  config: AppConfig,
  cenario: CenarioConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const isInterna = dest.uf.toUpperCase() === 'SC';
  const isIndustrial = !!dest.cnpj && config.listaIndustriais.includes(dest.cnpj);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = dest.indIEDest === '9';

  const checks: CrossCheck[] = [
    { label: 'Remessa interna (SC para SC)?', ok: isInterna, regra: 'CK10A' },
    { label: 'Dest. na lista de industriais?', ok: isIndustrial, regra: 'CK10B' },
    { label: 'Dest. e optante do Simples Nacional?', ok: !isSN, regra: 'CK10C' },
    { label: 'Dest. e nao contribuinte?', ok: !isNC, regra: 'CK10D' },
  ];

  const hasJustification = cenario.id === 'B3'
    ? (isInterna && isIndustrial && !isSN && !isNC)
    : (isInterna && !isSN && !isNC);

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

  const checks: CrossCheck[] = [
    { label: 'Dest. e optante do Simples Nacional?', ok: isB4 ? true : !isSN, regra: 'CK04A' },
    { label: 'CST origem = 6 (deveria ser 12%)?', ok: !cstOrig6, regra: 'CK04B' },
    { label: 'CST origem = 1 (importado com similar)?', ok: cstOrig1, regra: 'CK04C' },
  ];

  const snOk = isB4 || !isSN;
  const hasJustification = snOk && !cstOrig6 && cstOrig1;
  return { checks, hasJustification };
}

function crossChecks17(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
): { checks: CrossCheck[]; hasJustification: boolean } {
  const bcReduzida = isBCReduzida(item);
  const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
  const isNC = dest.indIEDest === '9';

  const checks: CrossCheck[] = [
    { label: 'Base de calculo e reduzida?', ok: bcReduzida, regra: 'CK17A' },
    { label: 'Destinatario e Simples Nacional?', ok: isSN, regra: 'CK17B' },
    { label: 'Destinatario e nao contribuinte?', ok: isNC, regra: 'CK17C' },
  ];

  const hasJustification = bcReduzida || isSN || isNC;
  return { checks, hasJustification };
}

// ----- Função principal -----

export function validarAliquota(
  item: ItemData,
  cenario: CenarioConfig,
  dest: DestData,
  config: AppConfig,
): AliquotaResult {
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
        mensagem: 'Aliquota 4% valida, mas opcao 10% disponivel (mais credito para o cliente).',
        regra: 'AL06',
        cenario: cenario.id,
      },
      crossChecks: crossChecks04(item, dest, config, cenario).checks,
    };
  }

  const matches = aceitas.some(a => Math.abs(a - found) < 0.01);

  if (matches) {
    let crossResult: { checks: CrossCheck[]; hasJustification: boolean } | null = null;

    if (Math.abs(found - 12) < 0.01) {
      crossResult = crossChecks12(item, dest, config);
    } else if (Math.abs(found - 10) < 0.01) {
      crossResult = crossChecks10(item, dest, config, cenario);
    } else if (Math.abs(found - 4) < 0.01) {
      crossResult = crossChecks04(item, dest, config, cenario);
    } else if (Math.abs(found - 17) < 0.01) {
      crossResult = crossChecks17(item, dest, config);
    }

    if (crossResult && !crossResult.hasJustification) {
      return {
        result: {
          status: 'ALERTA',
          mensagem: `Aliquota ${found}% aceita para cenario ${cenario.id}, mas verificacoes adicionais apresentam divergencias.`,
          regra: 'AL02',
          cenario: cenario.id,
        },
        crossChecks: crossResult.checks,
      };
    }

    return {
      result: {
        status: 'OK',
        mensagem: `Aliquota ${found}% conforme cenario ${cenario.id}.`,
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
    checks = crossChecks10(item, dest, config, cenario).checks;
  } else if (Math.abs(found - 4) < 0.01) {
    checks = crossChecks04(item, dest, config, cenario).checks;
  } else if (Math.abs(found - 17) < 0.01) {
    checks = crossChecks17(item, dest, config).checks;
  }

  return {
    result: {
      status: 'ERRO',
      mensagem: `Aliquota ${found}% diverge do esperado para cenario ${cenario.id}. Esperado: ${aceitas.join('% ou ')}%.`,
      regra: 'AL01',
      cenario: cenario.id,
    },
    crossChecks: checks,
  };
}
