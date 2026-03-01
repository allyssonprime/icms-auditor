const UF_12_PERCENT = new Set(['PR', 'RJ', 'RS', 'SP']);

export function getAliquotaInterestadual(uf: string): number {
  return UF_12_PERCENT.has(uf.toUpperCase()) ? 12 : 7;
}
