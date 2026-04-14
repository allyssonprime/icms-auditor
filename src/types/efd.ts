/** Company info from EFD register 0000 */
export interface EfdCompanyInfo {
  cnpj: string;
  nome: string;
  uf: string;
  /** "MM/AAAA" extracted from DT_INI */
  competencia: string;
  dtIni: string;
  dtFin: string;
}

/** Parsed C113 register — referenced document (child of C100) */
export interface EfdC113 {
  indOper: string;
  numDoc: string;
  dtDoc: string;
  chvNfe: string;
}

/** Parsed C190 register — CST/CFOP/Aliquota consolidation (child of C100) */
export interface EfdC190 {
  cst: string;
  cfop: string;
  aliqIcms: number;
  vlOpr: number;
  vlBcIcms: number;
  vlIcms: number;
}

/** Parsed C100 register — one NF-e document */
export interface EfdC100 {
  /** 0=entrada, 1=saída */
  indOper: '0' | '1';
  /** 0=própria, 1=terceiros */
  indEmit: '0' | '1';
  /** 00=regular, 02=cancelado, 05=denegado, 06=complementar */
  codSit: string;
  numDoc: string;
  serie: string;
  chvNfe: string;
  dtDoc: string;
  vlDoc: number;
  vlBcIcms: number;
  vlIcms: number;
  /** Child C110 records: complementary info texts */
  c110Texts: string[];
  /** Child C113 records: referenced documents */
  c113Refs: EfdC113[];
  /** Child C190 records: CST/CFOP/Aliquota consolidation */
  c190Items: EfdC190[];
  /** Derived: COD_SIT === '02' */
  isCancelado: boolean;
  /** Derived: any C110 text contains "TTD" */
  hasTtd: boolean;
  /** Derived: referenced by another C100's C113 */
  isEstornada: boolean;
  estornadaPor: string | null;
  /** Derived: has C113 children (references another NF) */
  isEstorno: boolean;
  nfReferenciada: string | null;
}

/** Parsed E110 register — ICMS apuração totals */
export interface EfdE110 {
  vlTotDebitos: number;
  vlTotCreditos: number;
  vlSldApurado: number;
  vlIcmsRecolher: number;
  vlSldCredorTransportar: number;
}

/** Full parsed EFD result */
export interface EfdData {
  company: EfdCompanyInfo;
  c100s: EfdC100[];
  e110: EfdE110 | null;
  stats: {
    totalC100: number;
    c100Saidas: number;
    c100Entradas: number;
    c100Cancelados: number;
    c110ComTtd: number;
    c113Count: number;
  };
}

export type EfdParseResult =
  | { success: true; data: EfdData }
  | { success: false; error: string };
