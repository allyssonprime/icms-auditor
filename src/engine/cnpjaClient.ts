import type { CnpjInfo } from '../types/validation.ts';

// CNPJa Open API: https://open.cnpja.com/office/{cnpj}
// Limite: 5 requests/min (1 a cada 12 segundos para seguranca)
// Sem autenticacao. Usada como fallback quando OpenCNPJ falha.

const API_BASE = 'https://open.cnpja.com/office';
const MAX_RETRIES = 2;

// === DETECCAO CNAE INDUSTRIAL ===
// 1) Por codigo: divisoes 10-33 da CNAE 2.0 = Industria de Transformacao
//    Tambem 05-09 = Industria Extrativa (mineracao, etc.)
// 2) Por descricao: palavras-chave que indicam atividade industrial

const INDUSTRIAL_KEYWORDS = [
  'fabricacao', 'fabricação',
  'industria de', 'indústria de',
  'manufatura',
  'metalurgia', 'metalurgica', 'metalúrgica',
  'siderurgia', 'siderurgica', 'siderúrgica',
  'fundição', 'fundicao',
  'forjaria',
  'usinagem',
  'estamparia',
  'laminacao', 'laminação',
  'trefilacao', 'trefilação',
  'extrusao', 'extrusão',
  'moldagem',
  'montagem de',
  'producao de', 'produção de',
  'beneficiamento de',
  'transformacao de', 'transformação de',
  'processamento de',
  'refino de',
  'destilacao', 'destilação',
  'curtimento',
  'fiacao', 'fiação',
  'tecelagem',
  'confeccao de', 'confecção de',
  'serraria',
  'torrefacao', 'torrefação',
  'moagem',
  'frigorific',
  'abate de',
];

// Divisoes que nunca sao industriais, mesmo com keywords na descricao
// (ex: "Comercio atacadista de maquinas para uso industrial")
const NON_INDUSTRIAL_DIVISIONS = new Set([
  35, 36, 37, 38, 39,       // Eletricidade, agua, esgoto
  41, 42, 43,               // Construcao
  45, 46, 47,               // Comercio (atacadista e varejista)
  49, 50, 51, 52, 53,       // Transporte e correios
  55, 56,                   // Alojamento e alimentacao
  58, 59, 60, 61, 62, 63,  // Informacao e comunicacao
  64, 65, 66,               // Financeiro
  68,                       // Imobiliario
  69, 70, 71, 72, 73, 74, 75, // Servicos profissionais
  77, 78, 79, 80, 81, 82,  // Servicos administrativos
  84, 85, 86, 87, 88,      // Adm publica, educacao, saude
  90, 91, 92, 93, 94, 95, 96, 97, 99, // Outros servicos
]);

function isIndustrialByCode(cnae: string): boolean {
  const code = cnae.replace(/[.\-/]/g, '');
  if (code.length < 2) return false;
  const divisao = parseInt(code.slice(0, 2), 10);
  // Divisoes 05-09: Industria extrativa
  // Divisoes 10-33: Industria de transformacao
  return (divisao >= 5 && divisao <= 9) || (divisao >= 10 && divisao <= 33);
}

function isIndustrialByDescription(desc: string): boolean {
  if (!desc) return false;
  const lower = desc.toLowerCase();
  return INDUSTRIAL_KEYWORDS.some(kw => lower.includes(kw));
}

// Verifica apenas pelo CNAE principal (e sua descricao) para evitar falsos positivos.
// Se o codigo CNAE pertence a uma divisao claramente nao-industrial (comercio, servicos, etc),
// nao usa keywords da descricao (evita falso positivo tipo "Comercio de maquinas para uso industrial").
function checkIndustrial(primaryCnae: string, primaryDesc: string): boolean {
  if (isIndustrialByCode(primaryCnae)) return true;
  // Verificar a divisao do CNAE antes de usar keywords da descricao
  const code = primaryCnae.replace(/[.\-/]/g, '');
  const divisao = code.length >= 2 ? parseInt(code.slice(0, 2), 10) : 0;
  if (NON_INDUSTRIAL_DIVISIONS.has(divisao)) return false;
  if (isIndustrialByDescription(primaryDesc)) return true;
  return false;
}

// Parse da resposta da CNPJa Open API para CnpjInfo
export function parseCnpjaResponse(cnpj: string, data: Record<string, unknown>): CnpjInfo {
  const company = (data.company ?? data) as Record<string, unknown>;
  const simples = (company.simples ?? {}) as Record<string, unknown>;
  const simei = (company.simei ?? {}) as Record<string, unknown>;

  // CNPJa Open API usa: mainActivity.id, mainActivity.text
  //                       sideActivities[].id, sideActivities[].text
  // Fallbacks para outros formatos possiveis da API
  const primaryActivity = (
    data.mainActivity ??
    data.primaryActivity ??
    data.primary_activity ??
    {}
  ) as Record<string, unknown>;

  const secondaryActivities = (
    data.sideActivities ??
    data.secondaryActivities ??
    data.secondary_activities ??
    []
  ) as Array<Record<string, unknown>>;

  const cnaePrincipal = String(primaryActivity.id ?? primaryActivity.code ?? '');
  const cnaeDescricao = String(primaryActivity.text ?? primaryActivity.description ?? '');

  const cnaesSecundarios: string[] = [];
  for (const act of secondaryActivities) {
    const code = String(act.id ?? act.code ?? '');
    if (code) cnaesSecundarios.push(code);
  }

  const isIndustrial = checkIndustrial(cnaePrincipal, cnaeDescricao);

  // UF from address.state
  const address = (data.address ?? {}) as Record<string, unknown>;
  const uf = address.state ? String(address.state) : undefined;

  return {
    cnpj,
    razaoSocial: String(company.name ?? data.name ?? data.alias ?? ''),
    uf,
    simplesOptante: simples.optant != null ? Boolean(simples.optant) : null,
    isMei: simei.optant != null ? Boolean(simei.optant) : null,
    cnaePrincipal,
    cnaeDescricao,
    cnaesSecundarios,
    isIndustrial,
  };
}

// Fetch direto da API CNPJa (sem fila/cache — gerenciado pelo cnpjService)
export async function fetchFromCnpja(cnpj: string): Promise<{ info: CnpjInfo; rawData: Record<string, unknown> } | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/${cleanCnpj}`);

      if (response.status === 429) {
        console.warn('[CNPJa] Rate limited (429), aguardando 15s...');
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }

      if (!response.ok) {
        console.warn(`[CNPJa] HTTP ${response.status} para CNPJ ${cleanCnpj}`);
        return null;
      }

      const data = await response.json() as Record<string, unknown>;
      const info = parseCnpjaResponse(cleanCnpj, data);
      return { info, rawData: data };
    } catch (err) {
      console.warn(`[CNPJa] Erro na tentativa ${attempt + 1}/${MAX_RETRIES + 1}:`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  return null;
}

// Exportar para testes e uso pelo cnpjService
export { isIndustrialByCode, isIndustrialByDescription, checkIndustrial };
