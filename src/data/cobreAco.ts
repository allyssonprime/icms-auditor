export const COBRE_ACO_PREFIXES: string[] = [];

export function isCobreAco(ncm: string, configList?: string[]): boolean {
  if (!configList || configList.length === 0) return false;
  const normalized = ncm.replace(/\./g, '');
  return configList.some(prefix => normalized.startsWith(prefix.replace(/\./g, '')));
}
