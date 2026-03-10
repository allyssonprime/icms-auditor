import type { ItemData, NfeData } from './nfe.ts';

export type StatusType = 'OK' | 'ALERTA' | 'ERRO';

export interface ValidationResult {
  status: StatusType;
  mensagem: string;
  regra: string;
  cenario?: string;
}

export type CrossCheckSeverity = 'ok' | 'atencao' | 'divergente';

export interface CrossCheck {
  label: string;
  severity: CrossCheckSeverity;
  passed: boolean;
  regra: string;
}

export interface ItemValidation {
  item: ItemData;
  cenario: string;
  resultados: ValidationResult[];
  crossChecks: CrossCheck[];
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
  uf?: string;
  simplesOptante: boolean | null;
  isMei: boolean | null;
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
  vedado: Set<string>;
  creditoPresumido: Set<string>;
  tipoOperacao: Set<string>;
  searchText: string;
};

export interface GroupedData {
  label: string;
  count: number;
  totalBC: number;
  totalICMS: number;
}
