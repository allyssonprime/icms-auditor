/**
 * Servico Firebase para overrides manuais da classificacao CAMEX (carga 2,1
 * vs 3,6) usados pela view Apuracao TTD.
 *
 * Estrutura Firestore:
 *   /camexOverrides/byChave/{chaveAcesso}
 *   /camexOverrides/byPar/{cnpjDest_ncm}
 *
 * Cada documento contem `{ carga, origem, usuario?, timestamp }`. A leitura
 * carrega tudo de uma vez no `loadCamexOverrides()`, retornando dois maps
 * para consumo direto pelo engine `apuracaoTTD`.
 */

import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config.ts';
import type { CamexOverrideMap, CamexOverrideEntry } from '../engine/apuracaoTTD.ts';

const ROOT = 'camexOverrides';
const SUB_BY_CHAVE = 'byChave';
const SUB_BY_PAR = 'byPar';

export type CamexOverrideOrigem = 'manual_nf' | 'manual_par' | 'inherited';

interface CamexOverrideDoc {
  carga: 2.1 | 3.6;
  origem: CamexOverrideOrigem;
  usuario?: string;
  timestamp?: unknown;
}

function sanitizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

function sanitizarNcm(ncm: string): string {
  return ncm.replace(/\./g, '');
}

function parKey(cnpjDest: string, ncm: string): string {
  return `${sanitizarCnpj(cnpjDest)}_${sanitizarNcm(ncm)}`;
}

/** Carrega todos os overrides do Firebase em dois Maps. */
export async function loadCamexOverrides(): Promise<CamexOverrideMap> {
  const map: CamexOverrideMap = { byChave: new Map(), byPar: new Map() };
  try {
    const [snapChave, snapPar] = await Promise.all([
      getDocs(collection(db, ROOT, SUB_BY_CHAVE, 'items')),
      getDocs(collection(db, ROOT, SUB_BY_PAR, 'items')),
    ]);
    snapChave.forEach(d => {
      const data = d.data() as CamexOverrideDoc;
      map.byChave.set(d.id, { carga: data.carga, origem: data.origem });
    });
    snapPar.forEach(d => {
      const data = d.data() as CamexOverrideDoc;
      map.byPar.set(d.id, { carga: data.carga, origem: data.origem });
    });
  } catch (err) {
    console.error('[Firestore] Erro ao ler camex overrides:', err);
  }
  return map;
}

export async function setCamexOverrideByChave(
  chaveAcesso: string,
  carga: 2.1 | 3.6,
  usuario?: string,
): Promise<void> {
  try {
    const ref = doc(db, ROOT, SUB_BY_CHAVE, 'items', chaveAcesso);
    const payload: CamexOverrideDoc = {
      carga,
      origem: 'manual_nf',
      timestamp: serverTimestamp(),
    };
    if (usuario) payload.usuario = usuario;
    await setDoc(ref, payload);
  } catch (err) {
    console.error('[Firestore] Erro ao salvar override por chave:', err);
    throw err;
  }
}

export async function setCamexOverrideByPar(
  cnpjDest: string,
  ncm: string,
  carga: 2.1 | 3.6,
  usuario?: string,
): Promise<void> {
  try {
    const key = parKey(cnpjDest, ncm);
    const ref = doc(db, ROOT, SUB_BY_PAR, 'items', key);
    const payload: CamexOverrideDoc = {
      carga,
      origem: 'manual_par',
      timestamp: serverTimestamp(),
    };
    if (usuario) payload.usuario = usuario;
    await setDoc(ref, payload);
  } catch (err) {
    console.error('[Firestore] Erro ao salvar override por par:', err);
    throw err;
  }
}

export async function deleteCamexOverrideByChave(chaveAcesso: string): Promise<void> {
  try {
    await deleteDoc(doc(db, ROOT, SUB_BY_CHAVE, 'items', chaveAcesso));
  } catch (err) {
    console.error('[Firestore] Erro ao deletar override por chave:', err);
    throw err;
  }
}

export async function deleteCamexOverrideByPar(cnpjDest: string, ncm: string): Promise<void> {
  try {
    const key = parKey(cnpjDest, ncm);
    await deleteDoc(doc(db, ROOT, SUB_BY_PAR, 'items', key));
  } catch (err) {
    console.error('[Firestore] Erro ao deletar override por par:', err);
    throw err;
  }
}

/**
 * Aplica override por chave em massa. Usa writeBatch — atomico ate 500 docs.
 * Para mais que isso, precisamos quebrar em batches (TODO se necessario).
 */
export async function setCamexOverrideBulk(
  entries: Array<{ chaveAcesso: string; carga: 2.1 | 3.6 }>,
  usuario?: string,
): Promise<void> {
  if (entries.length === 0) return;
  if (entries.length > 500) {
    throw new Error('setCamexOverrideBulk: maximo 500 entradas por chamada');
  }
  try {
    const batch = writeBatch(db);
    for (const e of entries) {
      const ref = doc(db, ROOT, SUB_BY_CHAVE, 'items', e.chaveAcesso);
      const payload: CamexOverrideDoc = {
        carga: e.carga,
        origem: 'manual_nf',
        timestamp: serverTimestamp(),
      };
      if (usuario) payload.usuario = usuario;
      batch.set(ref, payload);
    }
    await batch.commit();
  } catch (err) {
    console.error('[Firestore] Erro no bulk override:', err);
    throw err;
  }
}

/** Helper utilitario reexportado para a UI usar o mesmo formato de chave. */
export function camexParKey(cnpjDest: string, ncm: string): string {
  return parKey(cnpjDest, ncm);
}

/** Aplica um override "ja carregado" diretamente no map em memoria.
 *  Util para feedback otimista na UI antes do round-trip Firebase. */
export function applyOverrideToMap(
  map: CamexOverrideMap,
  type: 'chave' | 'par',
  key: string,
  entry: CamexOverrideEntry,
): CamexOverrideMap {
  const next: CamexOverrideMap = {
    byChave: new Map(map.byChave),
    byPar: new Map(map.byPar),
  };
  if (type === 'chave') next.byChave.set(key, entry);
  else next.byPar.set(key, entry);
  return next;
}

/** Remove um override do map em memoria (otimista). */
export function removeOverrideFromMap(
  map: CamexOverrideMap,
  type: 'chave' | 'par',
  key: string,
): CamexOverrideMap {
  const next: CamexOverrideMap = {
    byChave: new Map(map.byChave),
    byPar: new Map(map.byPar),
  };
  if (type === 'chave') next.byChave.delete(key);
  else next.byPar.delete(key);
  return next;
}
