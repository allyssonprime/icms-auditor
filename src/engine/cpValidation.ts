import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

/**
 * Valida Crédito Presumido do item contra o cenário classificado.
 *
 * Duas checagens:
 *  1. CP01 — cenário espera CP e XML não traz cCredPresumido → AVISO
 *  2. CP02 — cenário NÃO espera CP e XML traz cCredPresumido → AVISO
 */
export function validarCreditoPresumido(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult[] {
  const resultados: ValidationResult[] = [];
  const temCpNoXml = item.cCredPresumido.trim().length > 0;

  // CP01 — esperado mas ausente
  if (cenario.temCP && !temCpNoXml) {
    resultados.push({
      status: 'AVISO',
      mensagem:
        `Cenário ${cenario.id} prevê crédito presumido (${cenario.refTTD}), mas nenhum ` +
        `gCred/cCredPresumido foi declarado no XML.`,
      regra: 'CP01',
      cenario: cenario.id,
    });
  }

  // CP02 — presente mas não esperado
  if (!cenario.temCP && temCpNoXml) {
    resultados.push({
      status: 'AVISO',
      mensagem:
        `Cenário ${cenario.id} não prevê crédito presumido, mas o XML declara ` +
        `cCredPresumido=${item.cCredPresumido}.`,
      regra: 'CP02',
      cenario: cenario.id,
    });
  }

  return resultados;
}
