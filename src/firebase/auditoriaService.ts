import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, orderBy, limit as firestoreLimit, serverTimestamp,
  writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from './config.ts';
import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { AuditoriaDoc, AuditoriaResumo, AuditoriaConfigSnapshot, NfeDoc } from '../types/auditoria.ts';

const COLLECTION = 'auditorias';

function nfeValidationToDoc(nv: NfeValidation): NfeDoc {
  return {
    numero: nv.nfe.numero,
    serie: nv.nfe.serie,
    emitCnpj: nv.nfe.emitCnpj,
    emitNome: nv.nfe.emitNome,
    emitUF: nv.nfe.emitUF,
    dest: {
      cnpj: nv.nfe.dest.cnpj,
      cpf: nv.nfe.dest.cpf,
      nome: nv.nfe.dest.nome,
      uf: nv.nfe.dest.uf,
      ie: nv.nfe.dest.ie,
      indIEDest: nv.nfe.dest.indIEDest,
    },
    statusFinal: nv.statusFinal,
    totalBC: nv.totalBC,
    totalICMSDestacado: nv.totalICMSDestacado,
    totalICMSRecolher: nv.totalICMSRecolher,
    totalFundos: nv.totalFundos,
    totalRecolherComFundos: nv.totalRecolherComFundos,
    itensCount: nv.itensValidados.length,
    fileName: nv.nfe.fileName,
    itensValidados: nv.itensValidados.map(iv => ({
      nItem: iv.item.nItem,
      ncm: iv.item.ncm,
      cfop: iv.item.cfop,
      cst: iv.item.cst,
      pICMS: iv.item.pICMS,
      vBC: iv.item.vBC,
      vICMS: iv.item.vICMS,
      cenario: iv.cenario,
      statusFinal: iv.statusFinal,
      mensagens: iv.resultados.map(r => `[${r.status}] ${r.mensagem}`),
    })),
  };
}

export async function salvarAuditoria(
  results: NfeValidation[],
  config: AppConfig,
  descartadasCfop: number,
  descartadasZero: number,
): Promise<string> {
  const resumo: AuditoriaResumo = {
    nfesOk: results.filter(r => r.statusFinal === 'OK').length,
    nfesAlerta: results.filter(r => r.statusFinal === 'ALERTA').length,
    nfesErro: results.filter(r => r.statusFinal === 'ERRO').length,
    totalBC: results.reduce((s, r) => s + r.totalBC, 0),
    totalICMSDestacado: results.reduce((s, r) => s + r.totalICMSDestacado, 0),
    totalICMSRecolher: results.reduce((s, r) => s + r.totalICMSRecolher, 0),
    totalFundos: results.reduce((s, r) => s + r.totalFundos, 0),
    totalRecolherComFundos: results.reduce((s, r) => s + r.totalRecolherComFundos, 0),
  };

  const configSnapshot: AuditoriaConfigSnapshot = {
    decreto2128Count: config.decreto2128.length,
    camexCount: config.listaCamex.length,
    cobreAcoCount: config.listaCobreAco.length,
    empresasCount: config.listaSN.length + config.listaIndustriais.length,
  };

  // Create auditoria header
  const auditoriaRef = await addDoc(collection(db, COLLECTION), {
    criadoEm: serverTimestamp(),
    totalNfes: results.length,
    descartadasCfop,
    descartadasZero,
    resumo,
    configSnapshot,
    status: 'ativa',
  });

  // Save NF-es in subcollection using batches (max 500 per batch)
  const nfeDocs = results.map(nv => ({
    id: nv.nfe.chaveAcesso,
    data: nfeValidationToDoc(nv),
  }));

  const BATCH_SIZE = 450; // leave margin below 500 limit
  for (let i = 0; i < nfeDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = nfeDocs.slice(i, i + BATCH_SIZE);
    for (const nfeDoc of chunk) {
      const nfeRef = doc(db, COLLECTION, auditoriaRef.id, 'nfes', nfeDoc.id);
      batch.set(nfeRef, nfeDoc.data);
    }
    await batch.commit();
  }

  console.log(`[Auditoria] Salva: ${auditoriaRef.id} (${results.length} NFs)`);
  return auditoriaRef.id;
}

export async function listarAuditorias(maxResults = 20): Promise<AuditoriaDoc[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('criadoEm', 'desc'),
      firestoreLimit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      const criadoEm = data.criadoEm instanceof Timestamp
        ? data.criadoEm.toDate()
        : new Date();
      return {
        id: d.id,
        criadoEm,
        totalNfes: data.totalNfes ?? 0,
        descartadasCfop: data.descartadasCfop ?? 0,
        descartadasZero: data.descartadasZero ?? 0,
        resumo: data.resumo ?? {},
        configSnapshot: data.configSnapshot ?? {},
        status: data.status ?? 'ativa',
      } as AuditoriaDoc;
    });
  } catch (err) {
    console.error('[Auditoria] Erro ao listar:', err);
    return [];
  }
}

export async function carregarNfes(auditoriaId: string): Promise<NfeDoc[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION, auditoriaId, 'nfes'));
    return snap.docs.map(d => d.data() as NfeDoc);
  } catch (err) {
    console.error(`[Auditoria] Erro ao carregar NFs de ${auditoriaId}:`, err);
    return [];
  }
}

export async function excluirAuditoria(auditoriaId: string): Promise<void> {
  try {
    // Delete subcollection first
    const nfesSnap = await getDocs(collection(db, COLLECTION, auditoriaId, 'nfes'));
    const BATCH_SIZE = 450;
    for (let i = 0; i < nfesSnap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = nfesSnap.docs.slice(i, i + BATCH_SIZE);
      for (const nfeDoc of chunk) {
        batch.delete(nfeDoc.ref);
      }
      await batch.commit();
    }
    // Delete header
    await deleteDoc(doc(db, COLLECTION, auditoriaId));
    console.log(`[Auditoria] Excluida: ${auditoriaId}`);
  } catch (err) {
    console.error(`[Auditoria] Erro ao excluir ${auditoriaId}:`, err);
  }
}
