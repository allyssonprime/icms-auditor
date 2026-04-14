import type { CenarioConfig } from '../types/cenario.ts';
import type { ItemData } from '../types/nfe.ts';
import { bcIntegral } from '../utils/formatters.ts';

/**
 * Deriva a carga efetiva correta para um item com base na aliquota REAL da NF-e.
 *
 * Problema que resolve: quando um item eh classificado em um cenario cujas
 * aliquotasAceitas nao incluem o pICMS declarado (ex.: item com pICMS=10 caiu
 * em B1 que espera 4%), usar cenario.cargaEfetiva cegamente leva a recolhimento
 * incorreto (1% quando deveria ser 3,6%).
 *
 * Regras:
 * - cenario.cargaEfetiva < 0 (B7/B12 sem CP): preservar valor negativo (caller trata)
 * - pICMS bate com cenario.aliquotasAceitas: usa cenario.cargaEfetiva
 *   - Excecao cobre/aco em aliquota 4%: sempre 0,6%
 * - pICMS diverge do cenario: deriva da aliquota real
 *   - pICMS ~ 0%: 0 (diferimento total)
 *   - pICMS ~ 4%: 1,0% (ou 0,6% se cobre/aco)
 *   - pICMS >= 7%: 3,6%
 *   - Caso nao mapeado: fallback para cenario.cargaEfetiva
 */
export function deriveCargaEfetiva(
  pICMS: number,
  cenario: CenarioConfig,
  isCobreAco: boolean,
): number {
  // Cenarios sem CP (recolhimento integral): preservar valor negativo
  if (cenario.cargaEfetiva < 0) return cenario.cargaEfetiva;

  // Regra absoluta: 4% → sempre 1,0% (0,6% cobre/aco).
  // Independe do cenario — ex.: B3 tem cargaEfetiva=3,6 mas item a 4% recolhe 1%.
  if (Math.abs(pICMS - 4) < 0.01) return isCobreAco ? 0.6 : 1.0;

  // Diferimento total
  if (pICMS < 0.01) return 0;

  // > 4%: usar carga do cenario se aliquota casa, senao derivar
  const matchesCenario = cenario.aliquotasAceitas.some(
    a => Math.abs(a - pICMS) < 0.01,
  );
  if (matchesCenario) return cenario.cargaEfetiva;

  // Aliquota diverge do cenario: >= 7% → 3,6%
  if (pICMS >= 7) return 3.6;

  return cenario.cargaEfetiva;
}

/**
 * Calcula o ICMS a recolher efetivo do item.
 *
 * Regra fiscal: o recolhimento do ICMS sob TTD 410 eh SEMPRE calculado
 * sobre a BC integral (valor nominal antes de qualquer reducao), aplicando
 * a carga efetiva do cenario. Quando o item tem reducao de BC declarada
 * (pRedBC > 0), a reducao serve apenas para destacar um vICMS menor no
 * XML, mas o contribuinte e obrigado a recolher sobre a base original.
 *
 * Exemplo: vProd=100, pRedBC=49%, pICMS=17 → vBC=51, vICMS=8,67.
 * Recolher correto sob TTD com carga 3,6% = 100 × 3,6% = 3,60 (NAO 8,67).
 *
 * O mesmo vale para fundos (calcularFundosItem) — sempre sobre BC integral.
 */
export function calcularICMSRecolherItem(
  item: ItemData,
  cenario: CenarioConfig,
  isCobreAco: boolean,
): number {
  const bc = bcIntegral(item.vBC, item.pRedBC);
  const carga = deriveCargaEfetiva(item.pICMS, cenario, isCobreAco);
  return carga > 0 ? bc * (carga / 100) : 0;
}

/**
 * Calcula fundos (0,4% padrao) do item. Sempre sobre a base integral
 * (valor nominal da operacao), independente de reducao de BC declarada.
 */
export function calcularFundosItem(
  item: ItemData,
  cenario: CenarioConfig,
): number {
  const bc = bcIntegral(item.vBC, item.pRedBC);
  return cenario.fundos > 0 ? bc * (cenario.fundos / 100) : 0;
}
