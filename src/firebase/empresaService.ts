import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config.ts';
import type { EmpresaFirestore } from '../types/empresa.ts';

const COLLECTION = 'empresas';

export async function getEmpresaFromFirestore(
  cnpj: string,
): Promise<EmpresaFirestore | null> {
  try {
    const ref = doc(db, COLLECTION, cnpj);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as EmpresaFirestore) : null;
  } catch (err) {
    console.error(`[Firestore] Erro ao ler empresa ${cnpj}:`, err);
    return null;
  }
}

export async function salvarEmpresaFirestore(
  cnpj: string,
  rawData: Record<string, unknown>,
): Promise<void> {
  try {
    const ref = doc(db, COLLECTION, cnpj);
    await setDoc(ref, { ...rawData, consultadoEm: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error(`[Firestore] Erro ao salvar empresa ${cnpj}:`, err);
  }
}
