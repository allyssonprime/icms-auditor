import type { CnpjInfo } from '../types/validation.ts';
import type { EmpresaFirestore } from '../types/empresa.ts';
import { getEmpresaFromFirestore, salvarEmpresaFirestore } from '../firebase/empresaService.ts';
import { checkIndustrial, fetchFromCnpja, parseCnpjaResponse } from './cnpjaClient.ts';

// === OpenCNPJ (principal) ===
// https://kitana.opencnpj.com/cnpj/{cnpj}
// Limite: 100 req/min -> intervalo de 650ms (margem de seguranca)

const OPENCNPJ_BASE = 'https://kitana.opencnpj.com/cnpj';
const OPENCNPJ_INTERVAL_MS = 650;
const CNPJA_INTERVAL_MS = 12500;
const MAX_RETRIES = 1;

// Check if a date is from the current month
function isCurrentMonth(date: unknown): boolean {
  if (!date) return false;
  // Firestore Timestamp
  const d = typeof (date as { toDate?: () => Date }).toDate === 'function'
    ? (date as { toDate: () => Date }).toDate()
    : date instanceof Date ? date : null;
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Cache em memoria
const cache = new Map<string, CnpjInfo>();

// Fila de requests com rate limiting
let lastOpenCnpjTime = 0;
let lastCnpjaTime = 0;
const pendingQueue: Array<{
  cnpj: string;
  force?: boolean;
  resolve: (info: CnpjInfo | null) => void;
}> = [];
let processing = false;

// === Parse da resposta OpenCNPJ ===

function parseOpenCnpjResponse(cnpj: string, data: Record<string, unknown>): CnpjInfo {
  const razaoSocial = String(data.razaoSocial ?? data.nomeFantasia ?? '');
  const opcaoSimples = String(data.opcaoSimples ?? '');
  const opcaoMei = String(data.opcaoMei ?? '');
  const uf = data.uf ? String(data.uf) : undefined;

  const cnaes = (data.cnaes ?? []) as Array<Record<string, unknown>>;
  const primary = cnaes[0];
  const cnaePrincipal = primary ? String(primary.cnae ?? '') : '';
  const cnaeDescricao = primary ? String(primary.descricao ?? '') : '';

  const cnaesSecundarios: string[] = [];
  for (let i = 1; i < cnaes.length; i++) {
    const code = String(cnaes[i]!.cnae ?? '');
    if (code) cnaesSecundarios.push(code);
  }

  const isIndustrial = checkIndustrial(cnaePrincipal, cnaeDescricao);

  return {
    cnpj,
    razaoSocial,
    uf,
    simplesOptante: opcaoSimples === 'S' ? true : opcaoSimples === 'N' ? false : null,
    isMei: opcaoMei === 'S' ? true : opcaoMei === 'N' ? false : null,
    cnaePrincipal,
    cnaeDescricao,
    cnaesSecundarios,
    isIndustrial,
  };
}

// === Parse de dados do Firestore (compativel com ambas APIs) ===

function parseFirestoreData(cnpj: string, doc: EmpresaFirestore): CnpjInfo {
  if (doc.fonte === 'opencnpj') {
    // Dados salvos pela OpenCNPJ
    return parseOpenCnpjResponse(cnpj, doc as unknown as Record<string, unknown>);
  }
  // Dados salvos pela CNPJa (formato legado ou explicito)
  return parseCnpjaResponse(cnpj, doc as unknown as Record<string, unknown>);
}

// === Fetch da OpenCNPJ ===

async function fetchFromOpenCnpj(cnpj: string): Promise<{ info: CnpjInfo; rawData: Record<string, unknown> } | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${OPENCNPJ_BASE}/${cnpj}`);

      if (response.status === 429) {
        console.warn('[OpenCNPJ] Rate limited (429)');
        return null; // fallback para CNPJa
      }

      if (!response.ok) {
        console.warn(`[OpenCNPJ] HTTP ${response.status} para CNPJ ${cnpj}`);
        return null;
      }

      const json = await response.json();
      const data = (json.data ?? json) as Record<string, unknown>;
      const info = parseOpenCnpjResponse(cnpj, data);
      return { info, rawData: data };
    } catch (err) {
      console.warn(`[OpenCNPJ] Erro na tentativa ${attempt + 1}/${MAX_RETRIES + 1}:`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  return null;
}

// === Processamento da fila ===

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (pendingQueue.length > 0) {
    const entry = pendingQueue.shift()!;

    if (!entry.force) {
      // 1. Cache em memoria
      const cached = cache.get(entry.cnpj);
      if (cached) {
        entry.resolve(cached);
        continue;
      }

      // 2. Firestore (use cached data only if from current month)
      const firestoreData = await getEmpresaFromFirestore(entry.cnpj);
      if (firestoreData && isCurrentMonth(firestoreData.consultadoEm)) {
        const info = parseFirestoreData(entry.cnpj, firestoreData);
        cache.set(entry.cnpj, info);
        entry.resolve(info);
        continue;
      }
    }

    // 3. OpenCNPJ (principal) — rate limit 650ms
    const now = Date.now();
    const elapsed = now - lastOpenCnpjTime;
    if (elapsed < OPENCNPJ_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, OPENCNPJ_INTERVAL_MS - elapsed));
    }
    lastOpenCnpjTime = Date.now();

    const openResult = await fetchFromOpenCnpj(entry.cnpj);
    if (openResult) {
      console.log(`[OpenCNPJ] OK: ${entry.cnpj} — ${openResult.info.razaoSocial}`);
      cache.set(entry.cnpj, openResult.info);
      salvarEmpresaFirestore(entry.cnpj, { fonte: 'opencnpj', ...openResult.rawData });
      entry.resolve(openResult.info);
      continue;
    }

    // 4. Fallback: CNPJa — rate limit 12.5s
    console.warn(`[CNPJa fallback] Tentando CNPJ ${entry.cnpj}...`);
    const nowFallback = Date.now();
    const elapsedFallback = nowFallback - lastCnpjaTime;
    if (elapsedFallback < CNPJA_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, CNPJA_INTERVAL_MS - elapsedFallback));
    }
    lastCnpjaTime = Date.now();

    const cnpjaResult = await fetchFromCnpja(entry.cnpj);
    if (cnpjaResult) {
      console.log(`[CNPJa fallback] OK: ${entry.cnpj} — ${cnpjaResult.info.razaoSocial}`);
      cache.set(entry.cnpj, cnpjaResult.info);
      salvarEmpresaFirestore(entry.cnpj, { fonte: 'cnpja', ...cnpjaResult.rawData });
      entry.resolve(cnpjaResult.info);
    } else {
      console.error(`[CNPJ] Falha em ambas APIs para ${entry.cnpj}`);
      entry.resolve(null);
    }
  }

  processing = false;
}

// === API publica ===

export function consultarCnpj(cnpj: string): Promise<CnpjInfo | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');

  const cached = cache.get(cleanCnpj);
  if (cached) return Promise.resolve(cached);

  return new Promise<CnpjInfo | null>(resolve => {
    pendingQueue.push({ cnpj: cleanCnpj, resolve });
    processQueue();
  });
}

export function reconsultarCnpj(cnpj: string): Promise<CnpjInfo | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  cache.delete(cleanCnpj);
  return new Promise<CnpjInfo | null>(resolve => {
    pendingQueue.push({ cnpj: cleanCnpj, force: true, resolve });
    processQueue();
  });
}

export function getCachedCnpj(cnpj: string): CnpjInfo | undefined {
  return cache.get(cnpj.replace(/\D/g, ''));
}

export function getCacheSize(): number {
  return cache.size;
}

export function getQueueSize(): number {
  return pendingQueue.length;
}
