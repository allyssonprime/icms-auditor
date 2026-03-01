import type { CnpjInfo } from '../types/validation.ts';

// CNPJa Open API: https://open.cnpja.com/office/{cnpj}
// Limite: 5 requests/min (1 a cada 12 segundos para seguranca)
// Sem autenticacao. Consulta apenas quando necessario (divergencias).

const API_BASE = 'https://open.cnpja.com/office';
const MIN_INTERVAL_MS = 12500; // 12.5s = ~4.8 req/min (margem de seguranca)
const MAX_RETRIES = 2;

// CNAEs de industria (divisoes 10-33 da CNAE 2.0 = Industria de Transformacao)
function isIndustrialCnae(cnae: string): boolean {
  const code = cnae.replace(/[.\-/]/g, '');
  if (code.length < 2) return false;
  const divisao = parseInt(code.slice(0, 2), 10);
  return divisao >= 10 && divisao <= 33;
}

// Cache local em memoria
const cache = new Map<string, CnpjInfo>();

// Fila de requests com rate limiting
let lastRequestTime = 0;
const pendingQueue: Array<{
  cnpj: string;
  resolve: (info: CnpjInfo | null) => void;
}> = [];
let processing = false;

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (pendingQueue.length > 0) {
    const entry = pendingQueue.shift()!;

    // Checar cache primeiro
    const cached = cache.get(entry.cnpj);
    if (cached) {
      entry.resolve(cached);
      continue;
    }

    // Rate limit: esperar intervalo minimo
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }

    const info = await fetchCnpj(entry.cnpj);
    entry.resolve(info);
  }

  processing = false;
}

async function fetchCnpj(cnpj: string): Promise<CnpjInfo | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastRequestTime = Date.now();
      const response = await fetch(`${API_BASE}/${cleanCnpj}`);

      if (response.status === 429) {
        // Rate limited — esperar mais e tentar novamente
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const info = parseResponse(cleanCnpj, data);
      cache.set(cleanCnpj, info);
      return info;
    } catch {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  return null;
}

function parseResponse(cnpj: string, data: Record<string, unknown>): CnpjInfo {
  const company = (data.company ?? data) as Record<string, unknown>;
  const simples = (company.simples ?? {}) as Record<string, unknown>;
  const primaryActivity = (data.primaryActivity ?? data.primary_activity ?? {}) as Record<string, unknown>;
  const secondaryActivities = (data.secondaryActivities ?? data.secondary_activities ?? []) as Array<Record<string, unknown>>;

  const cnaePrincipal = String(primaryActivity.code ?? primaryActivity.id ?? '');
  const cnaeDescricao = String(primaryActivity.description ?? primaryActivity.text ?? '');
  const cnaesSecundarios = secondaryActivities.map(a => String(a.code ?? a.id ?? ''));

  const allCnaes = [cnaePrincipal, ...cnaesSecundarios].filter(Boolean);
  const isIndustrial = allCnaes.some(isIndustrialCnae);

  return {
    cnpj,
    razaoSocial: String(company.name ?? data.name ?? data.alias ?? ''),
    simplesOptante: simples.optant != null ? Boolean(simples.optant) : null,
    cnaePrincipal,
    cnaeDescricao,
    cnaesSecundarios,
    isIndustrial,
  };
}

// API publica para o app
export function consultarCnpj(cnpj: string): Promise<CnpjInfo | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');

  // Retornar do cache se disponivel
  const cached = cache.get(cleanCnpj);
  if (cached) return Promise.resolve(cached);

  return new Promise<CnpjInfo | null>(resolve => {
    pendingQueue.push({ cnpj: cleanCnpj, resolve });
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
