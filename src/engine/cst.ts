import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

export function validarCST(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult {
  if (cenario.cstEsperado.length === 0) {
    return {
      status: 'OK',
      mensagem: `CST não validado para cenário ${cenario.id}.`,
      regra: 'CST00',
      cenario: cenario.id,
    };
  }

  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;
  const matches = cenario.cstEsperado.includes(cstTrib);

  if (matches) {
    return {
      status: 'OK',
      mensagem: `CST ${item.cst} conforme cenário ${cenario.id}.`,
      regra: 'CST01',
      cenario: cenario.id,
    };
  }

  return {
    status: 'ERRO',
    mensagem: `CST ${item.cst} diverge do esperado para cenário ${cenario.id}. Esperado sufixo: ${cenario.cstEsperado.join(' ou ')}.`,
    regra: 'CST01',
    cenario: cenario.id,
  };
}
