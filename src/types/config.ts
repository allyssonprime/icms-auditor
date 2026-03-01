export interface AppConfig {
  decreto2128: string[];
  listaCamex: string[];
  listaCobreAco: string[];
  listaSN: string[];
  listaIndustriais: string[];
  listaCD: string[];
  listaVedacao25a: string[];
  listaVedacao25b: string[];
  ufAliquotas: Record<string, number>;
  aliquotasInternasValidas: number[];
}
