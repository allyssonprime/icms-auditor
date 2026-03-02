import type { ItemData } from '../types/nfe.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ValidationResult } from '../types/validation.ts';

// === REGRAS CST ===
// O CST ICMS tem 3 digitos: ORIGEM (1o) + TRIBUTACAO (2o e 3o)
//
// ORIGEM (1o digito) — o que importa:
//   1 = mercadoria estrangeira importada diretamente (com similar nacional)
//   6 = mercadoria estrangeira adquirida no mercado interno, SEM similar nacional → CAMEX
//   7 = mesma definicao do 6, adquirida de outra empresa importadora
//   Outros (0,2,3,4,5,8) = alertar, pois esperamos importador
//
// TRIBUTACAO (2 ultimos digitos) — nao diferenciar 00/51/90, todos aceitos.
//   Alertar SOMENTE quando:
//   - 10 = com Substituicao Tributaria (verificar se e esperado)
//   - 20 = com reducao de base de calculo (verificar)

export function validarCST(
  item: ItemData,
  cenario: CenarioConfig,
): ValidationResult {
  const orig = item.cstOrig;
  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;

  // === ORIGEM ===
  // Origens aceitas para importador: 1, 6, 7
  const origensImportador = ['1', '6', '7'];

  if (!origensImportador.includes(orig)) {
    return {
      status: 'ALERTA',
      mensagem: `CST origem ${orig} (${item.cst}): esperado 1 (importacao direta), 6 (sem similar/CAMEX) ou 7 (adq. mercado interno sem similar). Origem ${orig} pode indicar mercadoria nacional.`,
      regra: 'CST02',
      cenario: cenario.id,
    };
  }

  // Indicador CAMEX pela origem: 6 ou 7 = sem similar nacional
  const isCamexByOrigin = orig === '6' || orig === '7';

  // === TRIBUTACAO — alertas especificos ===
  // ST (10) = verificar se era esperado no cenario
  if (cstTrib === '10') {
    const stEsperado = cenario.cstEsperado.includes('10') || cenario.cstEsperado.includes('70');
    if (!stEsperado) {
      return {
        status: 'ALERTA',
        mensagem: `CST trib 10 (ST) no item ${item.nItem} — cenario ${cenario.id} normalmente nao tem ST. Verificar se ha ST devida.`,
        regra: 'CST03',
        cenario: cenario.id,
      };
    }
  }

  // Reducao BC (20) = sempre alertar para verificacao
  if (cstTrib === '20') {
    return {
      status: 'ALERTA',
      mensagem: `CST trib 20 (reducao BC) no item ${item.nItem}. Verificar se a reducao esta correta para cenario ${cenario.id}.`,
      regra: 'CST04',
      cenario: cenario.id,
    };
  }

  // Composicao para exibicao
  const origemLabel = isCamexByOrigin ? `CAMEX (orig ${orig})` : `orig ${orig}`;

  return {
    status: 'OK',
    mensagem: `CST ${item.cst} OK — ${origemLabel}, trib ${cstTrib}. Cenario ${cenario.id}.`,
    regra: 'CST01',
    cenario: cenario.id,
  };
}
