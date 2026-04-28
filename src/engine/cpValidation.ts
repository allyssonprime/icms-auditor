import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

/**
 * Código de crédito presumido esperado para o TTD 410 Prime.
 * Referência: Termo de Concessão 245000003024507 (SC850065).
 */
const CP_CODIGO_ESPERADO = 'SC850065';

/**
 * Valida Crédito Presumido do item contra o cenário classificado.
 *
 * Três checagens:
 *  1. CP01 — cenário espera CP e XML não traz gCred/cCredPresumido → AVISO
 *  2. CP02 — cenário NÃO espera CP e XML traz cCredPresumido → ERRO (CP indevido)
 *  3. CP03 — XML traz cCredPresumido com código diferente de SC850065 → AVISO
 */
export function validarCreditoPresumido(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult[] {
  const resultados: ValidationResult[] = [];
  const codigoCP = item.cCredPresumido.trim();
  const temCpNoXml = codigoCP.length > 0;

  // CP01 — cenário espera CP mas item não declara gCred/cCredPresumido
  if (cenario.temCP && !temCpNoXml) {
    resultados.push({
      status: 'AVISO',
      mensagem: `Item sem tag de crédito presumido (gCred) no XML. Cenário ${cenario.id} prevê CP (${cenario.refTTD || 'TTD 410'}).`,
      regra: 'CP01',
      cenario: cenario.id,
    });
  }

  // CP02 — cenário NÃO espera CP mas item declara (CP indevido)
  if (!cenario.temCP && temCpNoXml) {
    resultados.push({
      status: 'ERRO',
      mensagem: `Crédito presumido aplicado em cenário sem direito a CP (${cenario.id} — ${cenario.nome}). Código declarado: ${codigoCP}.`,
      regra: 'CP02',
      cenario: cenario.id,
      acao: { tipo: 'corrigir_nfe', campo: 'cCredPresumido', valorAtual: codigoCP, prioridade: 'alta' },
    });
  }

  // CP03 — código de CP diferente do esperado (SC850065)
  // Só dispara quando o cenário espera CP (senão CP02 já trata).
  if (cenario.temCP && temCpNoXml && codigoCP !== CP_CODIGO_ESPERADO) {
    resultados.push({
      status: 'AVISO',
      mensagem: `Código de crédito presumido ${codigoCP} diferente do esperado (${CP_CODIGO_ESPERADO}).`,
      regra: 'CP03',
      cenario: cenario.id,
      acao: { tipo: 'verificar_documento', campo: 'cCredPresumido', valorAtual: codigoCP, valorEsperado: CP_CODIGO_ESPERADO, prioridade: 'media' },
    });
  }

  return resultados;
}
