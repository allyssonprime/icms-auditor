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
  isCAMEX?: boolean,
): ValidationResult {
  const orig = item.cstOrig;
  const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;

  // === ORIGEM ===
  // Origens aceitas para importador: 1, 6, 7
  const origensImportador = ['1', '6', '7'];

  if (!origensImportador.includes(orig)) {
    return {
      status: 'AVISO',
      mensagem: `CST origem ${orig} (${item.cst}): esperado 1 (importacao direta), 6 (sem similar/CAMEX) ou 7 (adq. mercado interno sem similar). Origem ${orig} pode indicar mercadoria nacional.`,
      regra: 'CST02',
      cenario: cenario.id,
      acao: { tipo: 'verificar_cadastro', campo: 'CST Origem', valorAtual: orig, valorEsperado: '1/6/7', prioridade: 'media' },
    };
  }

  // Alerta: CAMEX via lista NCM mas origem 1 (com similar) — possivel contradicao
  if (isCAMEX && orig === '1') {
    return {
      status: 'AVISO',
      mensagem: `NCM na lista CAMEX mas CST Origem = 1 (com similar nacional). Verificar se a origem deveria ser 6 (sem similar).`,
      regra: 'CST05',
      cenario: cenario.id,
      acao: { tipo: 'verificar_documento', campo: 'CST Origem', valorAtual: orig, valorEsperado: '6', prioridade: 'media' },
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
        status: 'DIVERGENCIA',
        mensagem: `CST trib 10 (ST) no item ${item.nItem} — cenario ${cenario.id} normalmente nao tem ST. Verificar se ha ST devida.`,
        regra: 'CST03',
        cenario: cenario.id,
        acao: { tipo: 'verificar_documento', campo: 'CST', valorAtual: item.cst, prioridade: 'media' },
      };
    }
  }

  // Reducao BC (20) — v3 M02: apenas observar, sem alerta/divergencia.
  // Para importador TTD 409/410 a reducao de BC e recorrente e legitima.
  if (cstTrib === '20') {
    const carga = cenario.cargaEfetiva;
    if (item.pRedBC > 0 && carga > 0) {
      const aliqEfetiva = item.pICMS * (1 - item.pRedBC / 100);
      return {
        status: 'INFO',
        mensagem: `CST trib 20 (reducao BC) item ${item.nItem}: aliquota efetiva ${aliqEfetiva.toFixed(2)}% (pICMS ${item.pICMS}% x reducao ${item.pRedBC}%). Carga cenario ${cenario.id}: ${carga.toFixed(2)}%.`,
        regra: 'CST04',
        cenario: cenario.id,
        acao: { tipo: 'nenhuma', prioridade: 'baixa' },
      };
    } else {
      return {
        status: 'INFO',
        mensagem: `CST trib 20 (reducao BC) item ${item.nItem} sem pRedBC declarado ou sem carga efetiva calculavel no cenario ${cenario.id}.`,
        regra: 'CST04',
        cenario: cenario.id,
        acao: { tipo: 'nenhuma', prioridade: 'baixa' },
      };
    }
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
