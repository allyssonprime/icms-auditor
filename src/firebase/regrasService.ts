import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config.ts';
import type { RegrasConfig, GrupoRegra, VedacaoRule, RegrasGlobal } from '../types/regras.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';

const REGRAS_COLLECTION = 'regras';

// --- Merge helpers ---

function isGrupoStructureCompatible(firestoreGrupo: GrupoRegra, defaultGrupo: GrupoRegra): boolean {
  // Unico indicador de schema incompativel: chaves de condicoes divergem
  // (significa que um novo campo foi adicionado ao tipo CondicoesCenario)
  // Remover/adicionar branches com condicaoExtra e uma customizacao valida do usuario.
  const defaultCondKeys = Object.keys(defaultGrupo.condicoes).sort().join(',');
  const firestoreCondKeys = Object.keys(firestoreGrupo.condicoes).sort().join(',');
  return defaultCondKeys === firestoreCondKeys;
}

/**
 * Exportado para testes. Faz merge dos grupos Firestore com os defaults.
 * `deletedIds` contem IDs de grupos default que o usuario excluiu e nao devem
 * ser re-adicionados automaticamente.
 */
export function mergeGrupos(
  firestoreGrupos: GrupoRegra[],
  defaultGrupos: GrupoRegra[],
  deletedIds: string[] = [],
): GrupoRegra[] {
  const firestoreById = new Map(firestoreGrupos.map(g => [g.id, g]));
  const deletedSet = new Set(deletedIds);
  const result: GrupoRegra[] = [];

  for (const firestoreGrupo of firestoreGrupos) {
    const defaultGrupo = defaultGrupos.find(d => d.id === firestoreGrupo.id);
    if (defaultGrupo && !isGrupoStructureCompatible(firestoreGrupo, defaultGrupo)) {
      console.warn(`[regrasService] Grupo ${firestoreGrupo.id} tem schema antigo — substituindo pelo default.`);
      result.push(defaultGrupo);
    } else {
      result.push(firestoreGrupo);
    }
  }

  for (const defaultGrupo of defaultGrupos) {
    if (firestoreById.has(defaultGrupo.id)) continue;
    if (deletedSet.has(defaultGrupo.id)) continue; // respeitar exclusao do usuario
    console.warn(`[regrasService] Grupo ${defaultGrupo.id} ausente no Firestore — adicionando do default.`);
    result.push(defaultGrupo);
  }

  return result.sort((a, b) => a.prioridade - b.prioridade);
}

/** Calcula IDs de grupos default que foram excluidos pelo usuario. */
function computeDeletedIds(grupos: GrupoRegra[], defaults: GrupoRegra[]): string[] {
  const presentIds = new Set(grupos.map(g => g.id));
  return defaults.filter(d => !presentIds.has(d.id)).map(d => d.id);
}

// --- Leitura ---

export async function getRegrasFromFirestore(): Promise<RegrasConfig | null> {
  try {
    const [gruposSnap, vedacoesSnap, globalSnap] = await Promise.all([
      getDoc(doc(db, REGRAS_COLLECTION, 'grupos')),
      getDoc(doc(db, REGRAS_COLLECTION, 'vedacoes')),
      getDoc(doc(db, REGRAS_COLLECTION, 'global')),
    ]);

    const defaults = getDefaultRegras();
    let hasAny = false;

    let rawGrupos: GrupoRegra[] = defaults.grupos;
    let deletedIds: string[] = [];
    if (gruposSnap.exists()) {
      hasAny = true;
      const data = gruposSnap.data() as { items: GrupoRegra[]; deletedIds?: string[] };
      rawGrupos = data.items;
      deletedIds = data.deletedIds ?? [];
    }

    const grupos = gruposSnap.exists()
      ? mergeGrupos(rawGrupos, defaults.grupos, deletedIds)
      : rawGrupos;

    const vedacoes: VedacaoRule[] = vedacoesSnap.exists()
      ? ((hasAny = true), (vedacoesSnap.data() as { items: VedacaoRule[] }).items)
      : defaults.vedacoes;

    const global: RegrasGlobal = globalSnap.exists()
      ? ((hasAny = true), globalSnap.data() as RegrasGlobal)
      : defaults.global;

    if (!hasAny) return null;

    return { grupos, vedacoes, global };
  } catch (err) {
    console.error('[Firestore] Erro ao ler regras:', err);
    return null;
  }
}

// --- Escrita ---

export async function salvarGrupos(grupos: GrupoRegra[]): Promise<void> {
  try {
    const defaults = getDefaultRegras();
    const deletedIds = computeDeletedIds(grupos, defaults.grupos);
    const ref = doc(db, REGRAS_COLLECTION, 'grupos');
    await setDoc(ref, { items: grupos, deletedIds });
  } catch (err) {
    console.error('[Firestore] Erro ao salvar grupos:', err);
    throw err;
  }
}

export async function salvarVedacoes(vedacoes: VedacaoRule[]): Promise<void> {
  try {
    const ref = doc(db, REGRAS_COLLECTION, 'vedacoes');
    await setDoc(ref, { items: vedacoes });
  } catch (err) {
    console.error('[Firestore] Erro ao salvar vedacoes:', err);
    throw err;
  }
}

export async function salvarConfigGlobal(global: RegrasGlobal): Promise<void> {
  try {
    const ref = doc(db, REGRAS_COLLECTION, 'global');
    await setDoc(ref, global);
  } catch (err) {
    console.error('[Firestore] Erro ao salvar config global:', err);
    throw err;
  }
}

// --- Export / Import ---

export function exportRegrasJSON(regras: RegrasConfig): string {
  return JSON.stringify(regras, null, 2);
}

export function importRegrasJSON(json: string): RegrasConfig {
  const data = JSON.parse(json) as RegrasConfig;

  // Validacao basica
  if (!Array.isArray(data.grupos) || !Array.isArray(data.vedacoes) || !data.global) {
    throw new Error('JSON invalido: estrutura de regras incompleta');
  }

  for (const grupo of data.grupos) {
    if (!grupo.id || !grupo.nome || !Array.isArray(grupo.ramificacoes)) {
      throw new Error(`Grupo invalido: ${grupo.id ?? 'sem id'}`);
    }
    for (const ram of grupo.ramificacoes) {
      if (!ram.cenarioId || !ram.nome) {
        throw new Error(`Ramificacao invalida no grupo ${grupo.id}`);
      }
    }
  }

  return data;
}
