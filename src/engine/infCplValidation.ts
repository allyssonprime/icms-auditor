import type { CenarioConfig } from '../types/cenario.ts';
import type { ItemData } from '../types/nfe.ts';
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
 *            item NÃO declara cCredPresumido e o infCpl não menciona
 *            "diferimento parcial", "ICMS diferido" ou referência ao TTD → AVISO
 *
 * Regra: a presença de cCredPresumido declarado no XML é sinal forte de
 * aplicação do regime especial — a menção no infCpl é complementar. Portanto
 * IC01 só dispara quando o item NÃO tem CP declarado.
 *
 * O infCpl é um campo livre no cabeçalho da NF-e; os termos são avaliados
 * case/accent-insensitive.
 */
export function validarInfoComplementares(
  infCpl: string,
  cenario: CenarioConfig,
  item: ItemData,
): ValidationResult[] {
  const resultados: ValidationResult[] = [];

  // Se o item tem cCredPresumido declarado, o regime especial já está
  // evidenciado no XML — IC01 é informação complementar e não deve disparar.
  const hasCPDeclared = item.cCredPresumido.trim().length > 0;

  if (cenario.temDiferimentoParcial && !hasCPDeclared) {
    const texto = normalizar(infCpl ?? '');
    const ok = contemAlgum(texto, [
      'diferimento parcial',
      'icms diferido',
      'ttd 410',
      'ttd 1250', // prefixo dos Termos Prime (125000001544551 etc.)
    ]);
    if (!ok) {
      resultados.push({
        status: 'AVISO',
        mensagem:
          `Cenário ${cenario.id} exige menção a "diferimento parcial"/"ICMS diferido" ` +
          `ou referência ao TTD no infCpl (${cenario.refTTD || 'TTD 410'}), ` +
          `e o item não declara cCredPresumido.`,
        regra: 'IC01',
        cenario: cenario.id,
      });
    }
  }

  return resultados;
}
