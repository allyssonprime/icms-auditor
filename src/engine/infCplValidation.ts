import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

/**
 * Normaliza texto para matching case/accent-insensitive.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function contemAlgum(textoNorm: string, termos: string[]): boolean {
  return termos.some(t => textoNorm.includes(normalizar(t)));
}

/**
 * Valida informações complementares obrigatórias no infCpl da NF-e.
 *
 * Checagens:
 *  1. IC01 — diferimento parcial: cenario.temDiferimentoParcial === true e o
 *            infCpl não menciona "diferimento parcial" / "ICMS diferido" → AVISO
 *
 * O infCpl é um campo livre no cabeçalho da NF-e; os termos são avaliados
 * case/accent-insensitive.
 */
export function validarInfoComplementares(
  infCpl: string,
  cenario: CenarioConfig,
): ValidationResult[] {
  const resultados: ValidationResult[] = [];
  const texto = normalizar(infCpl ?? '');

  if (cenario.temDiferimentoParcial) {
    const ok = contemAlgum(texto, ['diferimento parcial', 'icms diferido']);
    if (!ok) {
      resultados.push({
        status: 'AVISO',
        mensagem:
          `Cenário ${cenario.id} exige menção a "diferimento parcial" ou ` +
          `"ICMS diferido" no campo infCpl (${cenario.refTTD || 'TTD 410'}).`,
        regra: 'IC01',
        cenario: cenario.id,
      });
    }
  }

  return resultados;
}
