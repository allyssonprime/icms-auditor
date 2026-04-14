import type { NfeData } from '../types/nfe.ts';

/**
 * Motivos de exclusao de NF do pipeline de auditoria TTD.
 */
export type ExclusionReason = 'cancelada' | 'sem_ttd' | 'estorno' | 'estornada';

export interface FilterResult {
  /** NFs que passaram nos 3 filtros */
  accepted: NfeData[];
  /** NFs excluidas com motivo */
  excluded: Array<{ nfe: NfeData; reason: ExclusionReason }>;
  /** Contadores por filtro */
  counts: {
    canceladas: number;
    semTtd: number;
    estornoPar: number; // pares estorno+estornada removidos
  };
}

// ============================================================
// FILTRO 1 — NFs Canceladas
// ============================================================
// Na UI (App.tsx), o filtro de canceladas opera no filesystem:
// verifica se existe _cancelada.xml para a mesma chave. Essa
// funcao eh usada quando se tem a lista de fileNames do lote.

/**
 * Dado um conjunto de nomes de arquivo no lote, retorna um Set
 * de chaves de acesso que possuem XML de cancelamento.
 *
 * Convencao: o prefixo do arquivo eh a chave NFe com 44 digitos:
 *   NFe<chave44>_autorizado.xml  / NFe<chave44>_cancelada.xml
 */
export function detectarCanceladas(fileNames: string[]): Set<string> {
  const canceladas = new Set<string>();
  for (const name of fileNames) {
    if (name.includes('_cancelada')) {
      // Extrai chave: tudo entre "NFe" e "_cancelada"
      const match = name.match(/NFe(\d{44})_cancelada/);
      if (match) canceladas.add(match[1]);
    }
  }
  return canceladas;
}

/**
 * Verifica se uma NF esta cancelada com base no Set de chaves canceladas.
 */
export function isCancelada(nfe: NfeData, canceladas: Set<string>): boolean {
  return canceladas.has(nfe.chaveAcesso);
}

// ============================================================
// FILTRO 2 — NFs sem beneficio TTD
// ============================================================
// Uma NF possui beneficio TTD quando QUALQUER um destes sinais
// esta presente:
//   1. "TTD" no infCpl (inclui infAdFisco, concatenado pelo parser)
//   2. cCredPresumido preenchido em algum item (ex: "SC850065")

/**
 * Retorna true se a NF possui indicacao de beneficio TTD.
 */
export function hasTtdBeneficio(nfe: NfeData): boolean {
  if (/ttd/i.test(nfe.infCpl)) return true;
  if (nfe.itens.some(i => i.cCredPresumido.trim().length > 0)) return true;
  return false;
}

// ============================================================
// FILTRO 3 — NFs estornadas via NFref
// ============================================================
// NFs de estorno referenciam a NF original atraves de <NFref>.
// Quando ambas estao no mesmo periodo, ambas devem ser excluidas.
// Se a NF referenciada NAO esta no periodo, a NF de estorno fica
// (eh um ajuste legitimo do periodo corrente).

/**
 * Aplica o filtro de estornos sobre um conjunto de NFs ja parseadas.
 *
 * Retorna Sets de chaves a excluir: estornos (NFs que contem NFref)
 * e estornadas (NFs referenciadas que estao no periodo).
 */
export function detectarEstornos(
  nfes: NfeData[],
): { estornos: Set<string>; estornadas: Set<string> } {
  // Indexar todas as chaves no periodo
  const chavesNoPeriodo = new Set(nfes.map(n => n.chaveAcesso));

  const estornos = new Set<string>();
  const estornadas = new Set<string>();

  for (const nfe of nfes) {
    if (nfe.refNFe.length === 0) continue;

    // NFs complementares (finNFe=2) referenciam a NF original mas NAO
    // sao estornos — elas SOMAM ao valor da NF original. Nao excluir.
    if (nfe.finNFe === '2') continue;

    // Verificar se ALGUMA NF referenciada esta no periodo
    let algumaRefNoPeriodo = false;
    for (const ref of nfe.refNFe) {
      if (chavesNoPeriodo.has(ref)) {
        estornadas.add(ref);
        algumaRefNoPeriodo = true;
      }
    }

    // Excluir a NF de estorno apenas se a estornada esta no periodo
    if (algumaRefNoPeriodo) {
      estornos.add(nfe.chaveAcesso);
    }
  }

  return { estornos, estornadas };
}

// ============================================================
// FILTRO INTEGRADO — aplica os 3 filtros em sequencia
// ============================================================

/**
 * Aplica os 3 filtros sobre um array de NFs ja parseadas.
 *
 * @param nfes - NFs parseadas com sucesso
 * @param canceladas - Set de chaves canceladas (do filesystem)
 * @returns Resultado com NFs aceitas, excluidas e contadores
 */
export function filtrarNfes(
  nfes: NfeData[],
  canceladas: Set<string>,
): FilterResult {
  const excluded: FilterResult['excluded'] = [];
  const counts = { canceladas: 0, semTtd: 0, estornoPar: 0 };

  // Filtro 1 — Canceladas
  const postCanceladas: NfeData[] = [];
  for (const nfe of nfes) {
    if (isCancelada(nfe, canceladas)) {
      excluded.push({ nfe, reason: 'cancelada' });
      counts.canceladas++;
    } else {
      postCanceladas.push(nfe);
    }
  }

  // Filtro 3 — Estornos (roda ANTES do filtro TTD)
  // Motivo: NFs de estorno frequentemente NAO possuem "TTD" no infCpl.
  // Se o filtro TTD rodasse primeiro, removeria os estornos do pool, e
  // as NFs estornadas (que TEM TTD) ficariam sem quem as referencie.
  const { estornos, estornadas } = detectarEstornos(postCanceladas);
  const postEstornos: NfeData[] = [];
  for (const nfe of postCanceladas) {
    if (estornos.has(nfe.chaveAcesso)) {
      excluded.push({ nfe, reason: 'estorno' });
      counts.estornoPar++;
    } else if (estornadas.has(nfe.chaveAcesso)) {
      excluded.push({ nfe, reason: 'estornada' });
      counts.estornoPar++;
    } else {
      postEstornos.push(nfe);
    }
  }

  // Filtro 2 — Sem TTD (roda por ultimo)
  const accepted: NfeData[] = [];
  for (const nfe of postEstornos) {
    if (!hasTtdBeneficio(nfe)) {
      excluded.push({ nfe, reason: 'sem_ttd' });
      counts.semTtd++;
    } else {
      accepted.push(nfe);
    }
  }

  return { accepted, excluded, counts };
}
