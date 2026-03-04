import type { ItemData, NfeData } from '../types/nfe.ts';
import type { ValidationResult } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';

export function verificarVedacoes(item: ItemData, nfe: NfeData, config: AppConfig): ValidationResult[] {
  const results: ValidationResult[] = [];
  const normalizedNcm = item.ncm.replace(/\./g, '');

  // V01: NCM no Decreto 2.128
  for (const prefix of config.decreto2128) {
    const normalizedPrefix = prefix.replace(/\./g, '');
    if (normalizedNcm.startsWith(normalizedPrefix)) {
      // Exceção: operação interna SC×SC com alíquota 12%+ e sem crédito presumido
      // → empresa não está usando o TTD, apenas ALERTA
      const isInternaSC = nfe.emitUF === 'SC' && nfe.dest.uf === 'SC';
      const aliquotaAlta = item.pICMS >= 12;
      const semCP = !item.cCredPresumido;

      if (isInternaSC && aliquotaAlta && semCP) {
        results.push({
          status: 'ALERTA',
          mensagem: `NCM ${item.ncm} consta no Decreto 2.128, porém operação interna SC com alíquota ${item.pICMS}% sem crédito presumido — verificar se TTD está sendo utilizado.`,
          regra: 'V01-EXC',
        });
      } else {
        results.push({
          status: 'ERRO',
          mensagem: `NCM ${item.ncm} vedada pelo Decreto 2.128. TTD não pode ser aplicado.`,
          regra: 'V01',
        });
      }
      break;
    }
  }

  // V02: Mercadoria usada (CFOPs específicos)
  if (['5922', '6922'].includes(item.cfop)) {
    results.push({
      status: 'ERRO',
      mensagem: 'TTD vedado para mercadoria usada.',
      regra: 'V02',
    });
  }

  return results;
}
