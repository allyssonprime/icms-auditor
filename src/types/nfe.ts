export interface NfeTotais {
  vBC: number;
  vICMS: number;
  vBCST: number;
  vST: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;
  vNF: number;
}

export interface NfeData {
  chaveAcesso: string;
  numero: string;
  serie: string;
  natOp: string;
  tpNF: string;
  dhEmi: string;
  emitCnpj: string;
  emitNome: string;
  emitUF: string;
  dest: DestData;
  itens: ItemData[];
  infCpl: string;
  fileName: string;
  totais: NfeTotais;
  /** Chaves de acesso referenciadas (NFref/refNFe) — usadas para detectar estornos */
  refNFe: string[];
  /** Finalidade da NF-e: 1=normal, 2=complementar, 3=ajuste, 4=devolucao */
  finNFe: string;
}

export interface DestData {
  cnpj?: string;
  cpf?: string;
  nome: string;
  uf: string;
  ie?: string;
  indIEDest: string;
}

export interface ItemData {
  nItem: string;
  descricao: string;
  ncm: string;
  cfop: string;
  cstOrig: string;
  cst: string;
  pICMS: number;
  vBC: number;
  vICMS: number;
  vProd: number;
  pRedBC: number;
  vBCST: number;
  vICMSST: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;
  cCredPresumido: string;
  pCredPresumido: number;
  vCredPresumido: number;
}
