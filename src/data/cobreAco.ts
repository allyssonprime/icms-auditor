export const COBRE_ACO_PREFIXES = ['72', '73', '74', '7106'];

export function isCobreAco(ncm: string, configList?: string[]): boolean {
  const normalized = ncm.replace(/\./g, '');
  const allPrefixes = configList && configList.length > 0
    ? [...COBRE_ACO_PREFIXES, ...configList]
    : COBRE_ACO_PREFIXES;
  return allPrefixes.some(prefix => normalized.startsWith(prefix.replace(/\./g, '')));
}
