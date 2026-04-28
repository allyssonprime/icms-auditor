import { describe, expect, it } from 'vitest';
import { getCenarios } from '../../engine/cenarios.ts';
import { getDefaultRegras } from '../../data/defaultRegras.ts';
import { makeConfig, makeDest, makeItem, makeNfe } from '../../engine/__tests__/fixtures.ts';
import type { NfeValidation } from '../../types/validation.ts';
import { buildDashboardGroups } from '../dashboardGroups.ts';

const REGRAS = getDefaultRegras();
const CENARIOS = getCenarios(REGRAS);

function makeValidation(overrides: {
  cenario: string;
  cnpjDest: string;
  ncm?: string;
  cstOrig?: string;
  pICMS?: number;
  vBC?: number;
  vICMS?: number;
}): NfeValidation {
  const item = makeItem({
    ncm: overrides.ncm ?? '85423190',
    cstOrig: overrides.cstOrig ?? '6',
    pICMS: overrides.pICMS ?? 12,
    vBC: overrides.vBC ?? 1000,
    vICMS: overrides.vICMS ?? 120,
  });
  const nfe = makeNfe({
    dest: makeDest({ cnpj: overrides.cnpjDest }),
    itens: [item],
  });

  return {
    nfe,
    itensValidados: [{
      item,
      cenario: overrides.cenario,
      resultados: [],
      crossChecks: [],
      statusFinal: 'OK',
      confianca: 'alta',
      bcConsistente: true,
    }],
    statusFinal: 'OK',
    totalBC: item.vBC,
    totalICMSDestacado: item.vICMS,
    totalICMSRecolher: 0,
    totalFundos: 0,
    totalRecolherComFundos: 0,
    totalCPDeclarado: 0,
    totalCPEsperado: 0,
  };
}

describe('buildDashboardGroups', () => {
  it('aplica CAMEX 2,10% como cálculo oficial apenas para itens CAMEX destinados a CNPJs cadastrados', () => {
    const config = makeConfig({
      listaCamex210: ['11.111.111/0001-11'],
    });
    const results = [
      makeValidation({ cenario: 'A2', cnpjDest: '11111111000111', cstOrig: '6' }),
      makeValidation({ cenario: 'A2', cnpjDest: '22222222000122', cstOrig: '6' }),
      makeValidation({ cenario: 'A1', cnpjDest: '11111111000111', cstOrig: '1' }),
    ];

    const { groups, grandTotal } = buildDashboardGroups(results, config, CENARIOS);

    expect(groups.find(g => g.label === '12% CAMEX (2,1%)')?.icmsRecolher).toBeCloseTo(21, 2);
    expect(groups.find(g => g.label === '12% CAMEX')?.icmsRecolher).toBeCloseTo(36, 2);
    expect(groups.find(g => g.label === '12%')?.icmsRecolher).toBeCloseTo(36, 2);
    expect(grandTotal.icmsRecolher).toBeCloseTo(93, 2);
  });
});
