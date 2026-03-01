import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

export function validarCFOP(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult {
  if (cenario.cfopsEsperados.length === 0) {
    return {
      status: 'OK',
      mensagem: `CFOP não validado para cenário ${cenario.id}.`,
      regra: 'CF00',
      cenario: cenario.id,
    };
  }

  if (cenario.cfopsEsperados.includes(item.cfop)) {
    return {
      status: 'OK',
      mensagem: `CFOP ${item.cfop} conforme cenário ${cenario.id}.`,
      regra: 'CF01',
      cenario: cenario.id,
    };
  }

  return {
    status: 'ALERTA',
    mensagem: `CFOP ${item.cfop} não é padrão para cenário ${cenario.id}. Esperado: ${cenario.cfopsEsperados.join(', ')}.`,
    regra: 'CF01',
    cenario: cenario.id,
  };
}
