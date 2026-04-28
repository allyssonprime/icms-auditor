import type { AppConfig } from '../types/config.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import type { ItemData } from '../types/nfe.ts';
import { deriveCargaEfetiva } from './calculoHelpers.ts';

export const REF_TTD_CAMEX_210_CNPJ = '1.2.d / 1.13.a';

export function normalizarCnpj(cnpj: string | undefined): string {
  return (cnpj ?? '').replace(/\D/g, '');
}

export function normalizarNcm(ncm: string): string {
  return ncm.replace(/\./g, '');
}

export function isItemCAMEX(item: ItemData, config: AppConfig, cenario?: CenarioConfig): boolean {
  if (item.cstOrig === '6') return true;
  const ncmNorm = normalizarNcm(item.ncm);
  if (config.listaCamex.some(c => ncmNorm.startsWith(normalizarNcm(c)))) return true;
  return cenario?.isCAMEX ?? false;
}

export function isDestinatarioCamex210(cnpj: string | undefined, config: AppConfig): boolean {
  const cnpjNorm = normalizarCnpj(cnpj);
  if (!cnpjNorm) return false;
  return config.listaCamex210.some(c => normalizarCnpj(c) === cnpjNorm);
}

export function aplicaCamex210PorCnpj(
  item: ItemData,
  cnpjDest: string | undefined,
  config: AppConfig,
  cenario?: CenarioConfig,
): boolean {
  return item.pICMS >= 7 && isItemCAMEX(item, config, cenario) && isDestinatarioCamex210(cnpjDest, config);
}

export function deriveCargaEfetivaComCamex210(
  item: ItemData,
  cenario: CenarioConfig,
  isCobreAco: boolean,
  cnpjDest: string | undefined,
  config: AppConfig,
): number {
  if (aplicaCamex210PorCnpj(item, cnpjDest, config, cenario)) return 2.1;
  return deriveCargaEfetiva(item.pICMS, cenario, isCobreAco);
}

export function getRefTTDEfetivaComCamex210(
  item: ItemData,
  cnpjDest: string | undefined,
  config: AppConfig,
  cenario?: CenarioConfig,
): string | undefined {
  if (aplicaCamex210PorCnpj(item, cnpjDest, config, cenario)) return REF_TTD_CAMEX_210_CNPJ;
  return cenario?.refTTD;
}
