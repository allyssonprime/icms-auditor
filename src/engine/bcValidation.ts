import type { ItemData } from '../types/nfe.ts';
import type { ValidationResult } from '../types/validation.ts';

const TOLERANCIA = 0.02;

/**
 * Valida consistência matemática da base de cálculo e campos relacionados.
 *
 * Três checagens:
 *  1. BC × pICMS ≈ vICMS (ERRO se divergir)
 *  2. BC < vProd × 0.98 sem redução declarada (AVISO — possível redução não informada)
 *  3. BC ≈ vProd - vDesc quando há desconto (INFO — desconto reduzindo BC)
 */
export function validarBaseCalculo(item: ItemData): ValidationResult[] {
  const resultados: ValidationResult[] = [];

  // Checagem 1: consistência matemática BC × pICMS = vICMS
  // Só aplica quando há ICMS próprio destacado (pICMS > 0).
  if (item.pICMS > 0) {
    const esperado = item.vBC * (item.pICMS / 100);
    const diff = Math.abs(esperado - item.vICMS);
    if (diff >= TOLERANCIA) {
      resultados.push({
        status: 'ERRO',
        mensagem:
          `Inconsistência matemática: vBC (${item.vBC.toFixed(2)}) × pICMS (${item.pICMS}%) = ` +
          `${esperado.toFixed(2)}, mas vICMS declarado é ${item.vICMS.toFixed(2)} (diferença ${diff.toFixed(2)}).`,
        regra: 'BC01',
      });
    }
  }

  // Checagem 2: BC significativamente menor que vProd sem redução declarada.
  // Ignora ST-puro (CST 60) onde vBC=0 é esperado, e casos com redução formal (CST 20 ou pRedBC > 0).
  const cstTrib = item.cst.slice(item.cstOrig.length);
  const isBCReduzidaDeclarada = cstTrib === '20' || item.pRedBC > 0;
  const semICMSProprio = cstTrib === '60' || cstTrib === '40' || cstTrib === '41' || cstTrib === '50';

  if (
    !isBCReduzidaDeclarada &&
    !semICMSProprio &&
    item.vProd > 0 &&
    item.vBC > 0 &&
    item.vBC < item.vProd * 0.98
  ) {
    // Se o desvio for explicado por desconto, vira INFO (checagem 3). Caso contrário, AVISO.
    const explicadoPorDesconto =
      item.vDesc > 0 && Math.abs(item.vBC - (item.vProd - item.vDesc)) < TOLERANCIA;

    if (explicadoPorDesconto) {
      resultados.push({
        status: 'INFO',
        mensagem:
          `BC reduzida pelo desconto comercial: vProd ${item.vProd.toFixed(2)} - vDesc ` +
          `${item.vDesc.toFixed(2)} = vBC ${item.vBC.toFixed(2)}.`,
        regra: 'BC03',
      });
    } else {
      const pct = ((1 - item.vBC / item.vProd) * 100).toFixed(2);
      resultados.push({
        status: 'INFO',
        mensagem:
          `BC (${item.vBC.toFixed(2)}) é ${pct}% menor que vProd (${item.vProd.toFixed(2)}) ` +
          `sem CST 20 nem pRedBC declarada. Possível redução de BC não informada.`,
        regra: 'BC02',
      });
    }
  }

  return resultados;
}

/**
 * True se nenhum resultado BC01 (inconsistência matemática) foi emitido.
 */
export function isBcConsistente(results: ValidationResult[]): boolean {
  return !results.some(r => r.regra === 'BC01');
}
