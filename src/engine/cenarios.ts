import type { CenarioConfig } from '../types/cenario.ts';
import { mergeValores, type RegrasConfig } from '../types/regras.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';

/** Expande todos os grupos de regras em um Record<cenarioId, CenarioConfig> */
export function getCenarios(regras: RegrasConfig): Record<string, CenarioConfig> {
  const result: Record<string, CenarioConfig> = {};

  for (const grupo of regras.grupos) {
    if (!grupo.ativo) continue;

    for (const ram of grupo.ramificacoes) {
      const valores = mergeValores(grupo.valoresBase, ram.override);
      const config: CenarioConfig = {
        id: ram.cenarioId,
        nome: ram.nome,
        isCAMEX: grupo.condicoes.camex === true || ram.condicaoExtra?.camex === true,
        aliquotasAceitas: valores.aliquotasAceitas,
        cargaEfetiva: valores.cargaEfetiva,
        fundos: valores.fundos,
        cstEsperado: valores.cstEsperado,
        cfopsEsperados: valores.cfopsEsperados,
        temCP: valores.temCP,
        temDiferimentoParcial: valores.temDiferimentoParcial,
        refTTD: valores.refTTD,
      };
      // Preferir branch catch-all (sem condicaoExtra) como config canonica.
      // Se nenhuma entrada existe ainda: registrar. Se existe mas esta branch e catch-all: sobrescrever.
      if (!result[ram.cenarioId] || !ram.condicaoExtra) {
        result[ram.cenarioId] = config;
      }
    }
  }

  return result;
}

/** Cenarios expandidos a partir dos defaults — compatibilidade com imports existentes */
export const CENARIOS: Record<string, CenarioConfig> = getCenarios(getDefaultRegras());
