import type { CenarioConfig } from '../types/cenario.ts';

export interface CalculoResult {
  aliquotaDestacada: number;
  icmsRecolhimento: number;
  icmsRecolhimentoPct: number;
  fundosSociais: number;
  fundosSociaisPct: number;
  totalRecolher: number;
  totalRecolherPct: number;
  creditoPresumido: number;
  bcIntegral: number;
}

/**
 * Calcula os valores fiscais do TTD 410 para um cenário classificado.
 *
 * Fórmulas (TTD 2ª fase, pós-36 meses):
 *   BC integral = valorOperacao (já inclui ICMS "por dentro")
 *   ICMS recolhimento = BC × cargaEfetiva
 *   Fundos = BC × 0,004 (0,4%)
 *   Total = ICMS recolhimento + Fundos
 *   CP = aliquotaDestacada - cargaEfetiva
 */
export function calcularTTD(
  cenario: CenarioConfig,
  valorOperacao: number,
  aliquotaDestacada: number,
  cargaEfetivaOverride?: number,
): CalculoResult {
  const bc = valorOperacao;
  const fundosPct = cenario.fundos;
  const cargaEfetiva = cargaEfetivaOverride ?? cenario.cargaEfetiva;

  // Cenários sem CP (B7-PF, B9-diferimento, B12-transferência interna):
  // ICMS é integral (alíquota cheia), sem crédito presumido
  const icmsRecolhimentoPct = cenario.temCP ? cargaEfetiva : aliquotaDestacada;
  const icmsRecolhimento = bc * (icmsRecolhimentoPct / 100);

  const fundosSociais = bc * (fundosPct / 100);
  const totalRecolher = icmsRecolhimento + fundosSociais;
  const totalRecolherPct = icmsRecolhimentoPct + fundosPct;

  // CP = diferença entre alíquota destacada e carga efetiva (quando tem CP)
  const creditoPresumido = cenario.temCP
    ? aliquotaDestacada - cargaEfetiva
    : 0;

  return {
    aliquotaDestacada,
    icmsRecolhimento: round2(icmsRecolhimento),
    icmsRecolhimentoPct,
    fundosSociais: round2(fundosSociais),
    fundosSociaisPct: fundosPct,
    totalRecolher: round2(totalRecolher),
    totalRecolherPct,
    creditoPresumido,
    bcIntegral: round2(bc),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
