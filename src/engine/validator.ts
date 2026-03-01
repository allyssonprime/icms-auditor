import type { NfeData, ItemData } from '../types/nfe.ts';
import type { NfeValidation, ItemValidation, ValidationResult, StatusType } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { verificarVedacoes } from './vedacoes.ts';
import { classificarCenario } from './classifier.ts';
import { CENARIOS } from './cenarios.ts';
import { validarAliquota } from './aliquota.ts';
import { validarCST } from './cst.ts';
import { validarCFOP } from './cfop.ts';

function resolveStatus(results: ValidationResult[]): StatusType {
  if (results.some(r => r.status === 'ERRO')) return 'ERRO';
  if (results.some(r => r.status === 'ALERTA')) return 'ALERTA';
  return 'OK';
}

function validarItem(
  nfe: NfeData,
  item: ItemData,
  config: AppConfig,
): ItemValidation {
  const resultados: ValidationResult[] = [];

  // Etapa 1: Vedações (bloqueante)
  const vedacoes = verificarVedacoes(item, config);
  resultados.push(...vedacoes);
  const bloqueado = vedacoes.some(v => v.status === 'ERRO');

  // Etapa 2: Classificar cenário
  const cenarioId = bloqueado ? 'VEDADO' : classificarCenario(item, nfe.dest, config);
  const cenario = CENARIOS[cenarioId];

  if (!bloqueado && cenario) {
    // Etapa 3: Validar alíquota
    resultados.push(validarAliquota(item, cenario, nfe.dest, config));
    // Etapa 4: Validar CST
    resultados.push(validarCST(item, cenario));
    // Etapa 5: Validar CFOP
    resultados.push(validarCFOP(item, cenario));
  } else if (!bloqueado && cenarioId === 'DEVOLUCAO') {
    resultados.push({
      status: 'ALERTA',
      mensagem: 'Devolucao detectada. Estornar CP apropriado (item 1.20). Fundos: creditar via DCIP 54.',
      regra: 'I09',
      cenario: 'DEVOLUCAO',
    });
  } else if (!bloqueado) {
    resultados.push({
      status: 'ALERTA',
      mensagem: 'Cenario nao identificado. Verificar manualmente.',
      regra: 'C-UNK',
    });
  }

  const statusFinal = resolveStatus(resultados);

  return { item, cenario: cenarioId, resultados, statusFinal };
}

export function validarNfe(nfe: NfeData, config: AppConfig): NfeValidation {
  const itensValidados = nfe.itens.map(item => validarItem(nfe, item, config));

  const statusFinal = resolveStatus(
    itensValidados.flatMap(iv => iv.resultados),
  );

  const totalBC = itensValidados.reduce((s, iv) => s + iv.item.vBC, 0);
  const totalICMSDestacado = itensValidados.reduce((s, iv) => s + iv.item.vICMS, 0);

  // ICMS a recolher = carga efetiva sobre BC
  const cenariosSemFundos = new Set(['B7', 'B9', 'B12', 'VEDADO', 'DEVOLUCAO', 'DESCONHECIDO']);

  let totalICMSRecolher = 0;
  let totalFundos = 0;

  for (const iv of itensValidados) {
    const cenario = CENARIOS[iv.cenario];
    if (cenario && cenario.cargaEfetiva > 0) {
      totalICMSRecolher += iv.item.vBC * (cenario.cargaEfetiva / 100);
    }
    if (!cenariosSemFundos.has(iv.cenario)) {
      totalFundos += iv.item.vBC * 0.004;
    }
  }

  const totalRecolherComFundos = totalICMSRecolher + totalFundos;

  return {
    nfe,
    itensValidados,
    statusFinal,
    totalBC,
    totalICMSDestacado,
    totalICMSRecolher,
    totalFundos,
    totalRecolherComFundos,
  };
}
