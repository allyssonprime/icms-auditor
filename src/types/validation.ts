import type { ItemData, NfeData } from './nfe.ts';

export type StatusType = 'OK' | 'ALERTA' | 'ERRO';

export interface ValidationResult {
  status: StatusType;
  mensagem: string;
  regra: string;
  cenario?: string;
}

export interface ItemValidation {
  item: ItemData;
  cenario: string;
  resultados: ValidationResult[];
  statusFinal: StatusType;
}

export interface NfeValidation {
  nfe: NfeData;
  itensValidados: ItemValidation[];
  statusFinal: StatusType;
  totalBC: number;
  totalICMSDestacado: number;
  totalICMSRecolher: number;
  totalFundos: number;
  totalRecolherComFundos: number;
}

export interface CnpjInfo {
  cnpj: string;
  razaoSocial: string;
  simplesOptante: boolean | null;
  cnaePrincipal: string;
  cnaeDescricao: string;
  cnaesSecundarios: string[];
  isIndustrial: boolean;
}

export type ActiveFilters = {
  aliquota: Set<number>;
  cst: Set<string>;
  cfop: Set<string>;
  cenario: Set<string>;
  status: Set<StatusType>;
};

export interface GroupedData {
  label: string;
  count: number;
  totalBC: number;
  totalICMS: number;
}
