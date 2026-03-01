import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

// CSTs 00 e 51 sao ambos aceitos na maioria dos cenarios.
// O importante e confrontar o CST de origem (1 = importacao direta, 6 = adquirida mercado interno/CAMEX).

export function validarCST(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult {
  if (cenario.cstEsperado.length === 0) {
    return {
      status: 'OK',
      mensagem: `CST nao validado para cenario ${cenario.id}.`,
      regra: 'CST00',
      cenario: cenario.id,
    };
  }

  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;
  const orig = item.cstOrig;

  // Aceitar 00 e 51 intercambiavelmente (exceto para ST que usa 10/70)
  const aceitos = [...cenario.cstEsperado];
  if (aceitos.includes('51') && !aceitos.includes('00')) aceitos.push('00');
  if (aceitos.includes('00') && !aceitos.includes('51')) aceitos.push('51');

  if (!aceitos.includes(cstTrib)) {
    return {
      status: 'ERRO',
      mensagem: `CST ${item.cst} (trib ${cstTrib}) diverge do esperado para cenario ${cenario.id}. Esperado: ${cenario.cstEsperado.join(' ou ')}.`,
      regra: 'CST01',
      cenario: cenario.id,
    };
  }

  // Validar digito de origem: importador deve usar 1 ou 6
  if (orig !== '1' && orig !== '6') {
    return {
      status: 'ALERTA',
      mensagem: `CST origem ${orig} (${item.cst}): para importador, esperado origem 1 (importacao direta) ou 6 (adquirida mercado interno/CAMEX).`,
      regra: 'CST02',
      cenario: cenario.id,
    };
  }

  return {
    status: 'OK',
    mensagem: `CST ${item.cst} conforme cenario ${cenario.id}.`,
    regra: 'CST01',
    cenario: cenario.id,
  };
}
