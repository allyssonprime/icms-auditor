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
  totalFundos: number;
}

export interface ProcessingSummary {
  total: number;
  ok: number;
  alertas: number;
  erros: number;
  totalBC: number;
  fundosEstimados: number;
}
