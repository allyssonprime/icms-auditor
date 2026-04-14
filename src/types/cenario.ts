export interface CenarioConfig {
  id: string;
  nome: string;
  aliquotasAceitas: number[];
  cargaEfetiva: number;
  fundos: number;
  cstEsperado: string[];
  cfopsEsperados: string[];
  temCP: boolean;
  temDiferimentoParcial: boolean;
  refTTD: string;
  /** true se o cenário exige produto sem similar nacional (CAMEX) */
  isCAMEX?: boolean;
}
