import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

// CFOPs com final 49 (conta e ordem) sao sempre aceitos.
// CFOPs com final 02 (venda) tambem sao aceitos, nao e erro.

function isContaEOrdem(cfop: string): boolean {
  return cfop.endsWith('49');
}

function isVenda(cfop: string): boolean {
  return cfop.endsWith('02');
}

export function validarCFOP(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult {
  if (cenario.cfopsEsperados.length === 0) {
    return {
      status: 'OK',
      mensagem: `CFOP nao validado para cenario ${cenario.id}.`,
      regra: 'CF00',
      cenario: cenario.id,
    };
  }

  // Aceito diretamente se esta na lista
  if (cenario.cfopsEsperados.includes(item.cfop)) {
    return {
      status: 'OK',
      mensagem: `CFOP ${item.cfop} conforme cenario ${cenario.id}.`,
      regra: 'CF01',
      cenario: cenario.id,
    };
  }

  // Conta e ordem (final 49) — sempre aceito
  if (isContaEOrdem(item.cfop)) {
    return {
      status: 'OK',
      mensagem: `CFOP ${item.cfop} (conta e ordem) aceito para cenario ${cenario.id}.`,
      regra: 'CF02',
      cenario: cenario.id,
    };
  }

  // Venda (final 02) — aceito, nao e erro
  if (isVenda(item.cfop)) {
    return {
      status: 'OK',
      mensagem: `CFOP ${item.cfop} (venda) aceito para cenario ${cenario.id}.`,
      regra: 'CF03',
      cenario: cenario.id,
    };
  }

  return {
    status: 'ALERTA',
    mensagem: `CFOP ${item.cfop} nao e padrao para cenario ${cenario.id}. Esperado: ${cenario.cfopsEsperados.join(', ')}.`,
    regra: 'CF01',
    cenario: cenario.id,
  };
}
