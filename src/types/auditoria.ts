import type { StatusType } from './validation.ts';

export interface AuditoriaResumo {
  nfesOk: number;
  nfesAlerta: number; // legacy — kept for backwards compatibility with stored docs
  nfesInfo: number;
  nfesAviso: number;
  nfesDivergencia: number;
  nfesErro: number;
  totalBC: number;
  totalICMSDestacado: number;
  totalICMSRecolher: number;
  totalFundos: number;
  totalRecolherComFundos: number;
}

export interface AuditoriaConfigSnapshot {
  decreto2128Count: number;
  camexCount: number;
  cobreAcoCount: number;
  empresasCount: number;
}

export interface AuditoriaDoc {
  id: string;
  criadoEm: Date;
  totalNfes: number;
  descartadasCfop: number;
  descartadasZero: number;
  resumo: AuditoriaResumo;
  configSnapshot: AuditoriaConfigSnapshot;
  status: 'ativa' | 'arquivada';
}

export interface NfeItemDoc {
  nItem: string;
  ncm: string;
  cfop: string;
  cst: string;
  pICMS: number;
  vBC: number;
  vICMS: number;
  cenario: string;
  statusFinal: StatusType;
  mensagens: string[];
}

export interface NfeDoc {
  numero: string;
  serie: string;
  emitCnpj: string;
  emitNome: string;
  emitUF: string;
  dest: {
    cnpj?: string;
    cpf?: string;
    nome: string;
    uf: string;
    ie?: string;
    indIEDest: string;
  };
  statusFinal: StatusType;
  totalBC: number;
  totalICMSDestacado: number;
  totalICMSRecolher: number;
  totalFundos: number;
  totalRecolherComFundos: number;
  itensCount: number;
  fileName: string;
  itensValidados: NfeItemDoc[];
}
