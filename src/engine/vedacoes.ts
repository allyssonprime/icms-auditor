import type { ItemData } from '../types/nfe.ts';
import type { ValidationResult } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';

export function verificarVedacoes(item: ItemData, config: AppConfig): ValidationResult[] {
  const results: ValidationResult[] = [];
  const normalizedNcm = item.ncm.replace(/\./g, '');

  // V01: NCM no Decreto 2.128
  for (const prefix of config.decreto2128) {
    const normalizedPrefix = prefix.replace(/\./g, '');
    if (normalizedNcm.startsWith(normalizedPrefix)) {
      results.push({
        status: 'ERRO',
        mensagem: `NCM ${item.ncm} vedada pelo Decreto 2.128. TTD não pode ser aplicado.`,
        regra: 'V01',
      });
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
