import type { ItemData, DestData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';
import { getAliquotaInterestadual } from '../data/ufAliquotas.ts';

export function validarAliquota(
  item: ItemData,
  cenario: CenarioConfig,
  dest: DestData,
): ValidationResult {
  const found = item.pICMS;

  // Para cenários sem alíquotas aceitas definidas (B9, B12), pular validação
  if (cenario.aliquotasAceitas.length === 0) {
    return {
      status: 'OK',
      mensagem: `Cenário ${cenario.id}: alíquota não validada (diferimento/transferência).`,
      regra: 'AL00',
      cenario: cenario.id,
    };
  }

  // Para cenários CAMEX interestaduais, resolver 7% ou 12% conforme UF
  let aceitas = cenario.aliquotasAceitas;
  if (['A2', 'A5', 'A7'].includes(cenario.id)) {
    const expected = getAliquotaInterestadual(dest.uf);
    aceitas = [expected];
  }

  // B3: 4% é válido mas 10% é a opção com mais crédito — alertar
  if (cenario.id === 'B3' && Math.abs(found - 4) < 0.01) {
    return {
      status: 'ALERTA',
      mensagem: 'Alíquota 4% válida, mas opção 10% disponível (mais crédito para o cliente).',
      regra: 'AL06',
      cenario: cenario.id,
    };
  }

  const matches = aceitas.some(a => Math.abs(a - found) < 0.01);

  if (matches) {
    return {
      status: 'OK',
      mensagem: `Alíquota ${found}% conforme cenário ${cenario.id}.`,
      regra: 'AL01',
      cenario: cenario.id,
    };
  }

  return {
    status: 'ERRO',
    mensagem: `Alíquota ${found}% diverge do esperado para cenário ${cenario.id}. Esperado: ${aceitas.join('% ou ')}%.`,
    regra: 'AL01',
    cenario: cenario.id,
  };
}
