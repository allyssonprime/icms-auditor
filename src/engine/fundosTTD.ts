/**
 * Calculo dos fundos parafiscais incidentes sobre as saidas com beneficio
 * fiscal do TTD 410, conforme estrutura do "Relatorio da Apuracao dos Creditos
 * por Regime Especial" da contabilidade.
 *
 * Fundos:
 *  - FUNDEC (Fundo Estadual de Defesa Civil): 0,05% sobre BC integral total
 *  - FUMDES (Fundo de Apoio a Educacao Superior): 2,00% sobre o credito
 *           presumido total (CP = vICMS - bcIntegral × cargaEfetiva)
 *  - Pro-Emprego: estrutura base 2,5% sobre BC, com varias deducoes. Para
 *                 empresas TTD 410 o valor "antes das deducoes" geralmente
 *                 ja vem zerado pelo proprio regime — MVP retorna 0 fixo.
 *                 TODO: confirmar formula com caso real onde Pro-Emprego ≠ 0.
 *  - Fundo Social: 0,40% sobre BC integral, descontando o FUMDES recolhido
 *                  (cap em zero — nao pode ser negativo).
 */

export const TAXA_FUNDEC = 0.05;
export const TAXA_FUMDES = 2.0;
export const TAXA_FUNDO_SOCIAL = 0.4;

export interface FundosTTD {
  /** FUNDEC = 0,05% × BC integral total */
  fundec: number;
  /** FUMDES = 2,00% × CP total */
  fumdes: number;
  /** Pro-Emprego: MVP retorna 0 fixo (TTD 410 zera antes das deducoes) */
  proEmprego: number;
  /** Fundo Social = max(0, 0,4% × BC − FUMDES) */
  fundoSocial: number;
}

/**
 * Calcula os 4 fundos a partir dos totais agregados de BC integral e
 * credito presumido (CP) do periodo.
 */
export function calcularFundosTTD(totalBC: number, totalCP: number): FundosTTD {
  const fundec = totalBC * (TAXA_FUNDEC / 100);
  const fumdes = totalCP * (TAXA_FUMDES / 100);
  // Pro-Emprego: MVP — retorna 0. Quando houver caso real para validar
  // a formula completa (com base "antes das deducoes" nao-zerada),
  // implementar aqui.
  const proEmprego = 0;
  const fundoSocialBruto = totalBC * (TAXA_FUNDO_SOCIAL / 100);
  const fundoSocial = Math.max(0, fundoSocialBruto - fumdes);
  return { fundec, fumdes, proEmprego, fundoSocial };
}
