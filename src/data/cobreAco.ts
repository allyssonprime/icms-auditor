export const COBRE_ACO_PREFIXES = ['72', '73', '74', '7106'];

export function isCobreAco(ncm: string): boolean {
  const normalized = ncm.replace(/\./g, '');
  return COBRE_ACO_PREFIXES.some(prefix => normalized.startsWith(prefix));
}
