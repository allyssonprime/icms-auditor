export interface NfeData {
  chaveAcesso: string;
  numero: string;
  serie: string;
  natOp: string;
  tpNF: string;
  dest: DestData;
  itens: ItemData[];
  infCpl: string;
  fileName: string;
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
  vBCST: number;
  vICMSST: number;
}
