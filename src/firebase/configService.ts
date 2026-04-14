import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './config.ts';

// === NCM Lists (config/ncmLists) ===

export interface NcmListsFirestore {
  decreto2128: string[];
  camex: string[];
  cobreAco: string[];
}

const NCM_DOC = 'ncmLists';
const CONFIG_COLLECTION = 'config';

export async function getNcmLists(): Promise<NcmListsFirestore | null> {
  try {
    const ref = doc(db, CONFIG_COLLECTION, NCM_DOC);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as NcmListsFirestore) : null;
  } catch (err) {
    console.error('[Firestore] Erro ao ler NCM lists:', err);
    return null;
  }
}

export async function salvarNcmLists(data: NcmListsFirestore): Promise<void> {
  try {
    const ref = doc(db, CONFIG_COLLECTION, NCM_DOC);
    await setDoc(ref, data);
  } catch (err) {
    console.error('[Firestore] Erro ao salvar NCM lists:', err);
  }
}

// === CNPJ Overrides (config/cnpjOverrides) ===

export interface CnpjOverridesFirestore {
  vedacao25a: string[];
  vedacao25b: string[];
  listaCD: string[];
  listaCamex210: string[];
}

const CNPJ_OVERRIDES_DOC = 'cnpjOverrides';

export async function getCnpjOverrides(): Promise<CnpjOverridesFirestore | null> {
  try {
    const ref = doc(db, CONFIG_COLLECTION, CNPJ_OVERRIDES_DOC);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as CnpjOverridesFirestore) : null;
  } catch (err) {
    console.error('[Firestore] Erro ao ler CNPJ overrides:', err);
    return null;
  }
}

export async function salvarCnpjOverrides(data: CnpjOverridesFirestore): Promise<void> {
  try {
    const ref = doc(db, CONFIG_COLLECTION, CNPJ_OVERRIDES_DOC);
    await setDoc(ref, data);
  } catch (err) {
    console.error('[Firestore] Erro ao salvar CNPJ overrides:', err);
  }
}

// === Empresas (read all for Cadastros page) ===

export interface EmpresaCadastro {
  cnpj: string;
  razaoSocial: string;
  simplesOptante: boolean | null;
  isMei: boolean | null;
  cnaePrincipal: string;
  cnaeDescricao: string;
  isIndustrial: boolean;
  ie?: string;
  uf?: string;
  // User override: if set, overrides isIndustrial for the 10% list
  industrialOverride?: boolean;
  consultadoEm?: Date;
}

export async function getAllEmpresas(): Promise<EmpresaCadastro[]> {
  try {
    const colRef = collection(db, 'empresas');
    const snap = await getDocs(colRef);
    const result: EmpresaCadastro[] = [];

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const cnpj = docSnap.id;

      // Parse both opencnpj and cnpja formats
      let razaoSocial = '';
      let simplesOptante: boolean | null = null;
      let isMei: boolean | null = null;
      let cnaePrincipal = '';
      let cnaeDescricao = '';
      let isIndustrial = false;
      let ie: string | undefined;
      let uf: string | undefined;

      if (data.fonte === 'opencnpj') {
        razaoSocial = data.razaoSocial ?? '';
        simplesOptante = data.opcaoSimples === 'S' ? true : data.opcaoSimples === 'N' ? false : null;
        isMei = data.opcaoMei === 'S' ? true : data.opcaoMei === 'N' ? false : null;
        const cnaes = (data.cnaes ?? []) as Array<{ cnae: string; descricao: string }>;
        if (cnaes[0]) {
          cnaePrincipal = cnaes[0].cnae ?? '';
          cnaeDescricao = cnaes[0].descricao ?? '';
        }
        uf = data.uf;
      } else {
        // CNPJa format
        const company = (data.company ?? {}) as Record<string, unknown>;
        razaoSocial = String(company.name ?? data.alias ?? '');
        const simples = (company.simples ?? {}) as Record<string, unknown>;
        const simei = (company.simei ?? {}) as Record<string, unknown>;
        simplesOptante = simples.optant != null ? Boolean(simples.optant) : null;
        isMei = simei.optant != null ? Boolean(simei.optant) : null;
        const mainAct = (data.mainActivity ?? {}) as Record<string, unknown>;
        cnaePrincipal = String(mainAct.id ?? '');
        cnaeDescricao = String(mainAct.text ?? '');
        const addr = (data.address ?? {}) as Record<string, unknown>;
        uf = String(addr.state ?? '');
      }

      // Check CNAE for industrial
      const code = cnaePrincipal.replace(/[.\-/]/g, '');
      const div = code.length >= 2 ? parseInt(code.slice(0, 2), 10) : 0;
      isIndustrial = (div >= 5 && div <= 9) || (div >= 10 && div <= 33);

      // consultadoEm
      let consultadoEm: Date | undefined;
      if (data.consultadoEm?.toDate) {
        consultadoEm = data.consultadoEm.toDate();
      }

      result.push({
        cnpj,
        razaoSocial,
        simplesOptante,
        isMei,
        cnaePrincipal,
        cnaeDescricao,
        isIndustrial,
        ie,
        uf,
        industrialOverride: data.industrialOverride,
        consultadoEm,
      });
    }

    return result.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));
  } catch (err) {
    console.error('[Firestore] Erro ao ler empresas:', err);
    return [];
  }
}

// === Load full AppConfig from Firebase ===

export interface AppBootstrapData {
  config: import('../types/config.ts').AppConfig;
  empresas: EmpresaCadastro[];
}

export async function loadFullAppConfig(defaults: import('../types/config.ts').AppConfig): Promise<AppBootstrapData> {
  const [ncm, overrides, empresas] = await Promise.all([
    getNcmLists(),
    getCnpjOverrides(),
    getAllEmpresas(),
  ]);

  const config = { ...defaults };

  // NCM lists from Firebase (fallback to defaults)
  if (ncm) {
    if (ncm.decreto2128.length > 0) config.decreto2128 = ncm.decreto2128;
    if (ncm.camex.length > 0) config.listaCamex = ncm.camex;
    if (ncm.cobreAco.length > 0) config.listaCobreAco = ncm.cobreAco;
  }

  // CNPJ overrides from Firebase
  if (overrides) {
    if (overrides.vedacao25a.length > 0) config.listaVedacao25a = overrides.vedacao25a;
    if (overrides.vedacao25b.length > 0) config.listaVedacao25b = overrides.vedacao25b;
    if (overrides.listaCD.length > 0) config.listaCD = overrides.listaCD;
    if (overrides.listaCamex210?.length > 0) config.listaCamex210 = overrides.listaCamex210;
  }

  // Derive listaSN and listaIndustriais from empresas
  config.listaSN = empresas
    .filter(e => e.simplesOptante === true)
    .map(e => e.cnpj);

  config.listaIndustriais = empresas
    .filter(e => e.industrialOverride !== undefined ? e.industrialOverride : e.isIndustrial)
    .map(e => e.cnpj);

  return { config, empresas };
}

export async function setIndustrialOverride(cnpj: string, override: boolean | undefined): Promise<void> {
  try {
    const ref = doc(db, 'empresas', cnpj);
    if (override === undefined) {
      // Remove the override field — use deleteField
      const { deleteField } = await import('firebase/firestore');
      await setDoc(ref, { industrialOverride: deleteField() }, { merge: true });
    } else {
      await setDoc(ref, { industrialOverride: override }, { merge: true });
    }
  } catch (err) {
    console.error(`[Firestore] Erro ao salvar override ${cnpj}:`, err);
  }
}
