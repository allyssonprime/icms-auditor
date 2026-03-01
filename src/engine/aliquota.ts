import type { ItemData, DestData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { getAliquotaInterestadual } from '../data/ufAliquotas.ts';

// Checagens adicionais para aliquotas especificas:
// 12%: verificar se item e Lista CAMEX (CST comecando com 6) e/ou NCM da lista CAMEX;
//       ou se destinatario e SN ou nao contribuinte.
// 10%: verificar se destinatario tem CNAE de industria.

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

export function validarAliquota(
  item: ItemData,
  cenario: CenarioConfig,
  dest: DestData,
  config: AppConfig,
): ValidationResult {
  const found = item.pICMS;

  // Para cenarios sem aliquotas aceitas definidas (B9, B12), pular validacao
  if (cenario.aliquotasAceitas.length === 0) {
    return {
      status: 'OK',
      mensagem: `Cenario ${cenario.id}: aliquota nao validada (diferimento/transferencia).`,
      regra: 'AL00',
      cenario: cenario.id,
    };
  }

  // Para cenarios CAMEX interestaduais, resolver 7% ou 12% conforme UF
  let aceitas = cenario.aliquotasAceitas;
  if (['A2', 'A5', 'A7'].includes(cenario.id)) {
    const expected = getAliquotaInterestadual(dest.uf);
    aceitas = [expected];
  }

  // B3: 4% e valido mas 10% e a opcao com mais credito — alertar
  if (cenario.id === 'B3' && Math.abs(found - 4) < 0.01) {
    return {
      status: 'ALERTA',
      mensagem: 'Aliquota 4% valida, mas opcao 10% disponivel (mais credito para o cliente).',
      regra: 'AL06',
      cenario: cenario.id,
    };
  }

  const matches = aceitas.some(a => Math.abs(a - found) < 0.01);

  if (matches) {
    const alertas: string[] = [];

    // Cross-check 12%: precisa ser CAMEX (CST orig 6 ou NCM na lista) OU dest SN/NC
    // Se nenhuma dessas condicoes e verdadeira, alertar para verificacao manual
    if (Math.abs(found - 12) < 0.01) {
      const camexByOrig = isCAMEXByOrigin(item);
      const camexByNCM = isCAMEXByNCM(item, config);
      const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);
      const isNC = dest.indIEDest === '9';

      if (!camexByOrig && !camexByNCM && !isSN && !isNC) {
        alertas.push('Aliquota 12% mas item nao e Lista CAMEX (orig != 6, NCM nao consta) e destinatario nao e SN nem NC. Verificar.');
      }
    }

    // Cross-check 10%: precisa ser destinatario com CNAE industrial
    if (Math.abs(found - 10) < 0.01) {
      const isIndustrial = !!dest.cnpj && config.listaIndustriais.includes(dest.cnpj);
      if (!isIndustrial && cenario.id === 'B3') {
        alertas.push('Aliquota 10% mas destinatario nao consta na lista de industriais. Verificar CNAE do destinatario.');
      }
    }

    if (alertas.length > 0) {
      return {
        status: 'ALERTA',
        mensagem: `Aliquota ${found}% aceita para cenario ${cenario.id}. ${alertas.join(' ')}`,
        regra: 'AL02',
        cenario: cenario.id,
      };
    }

    return {
      status: 'OK',
      mensagem: `Aliquota ${found}% conforme cenario ${cenario.id}.`,
      regra: 'AL01',
      cenario: cenario.id,
    };
  }

  return {
    status: 'ERRO',
    mensagem: `Aliquota ${found}% diverge do esperado para cenario ${cenario.id}. Esperado: ${aceitas.join('% ou ')}%.`,
    regra: 'AL01',
    cenario: cenario.id,
  };
}
