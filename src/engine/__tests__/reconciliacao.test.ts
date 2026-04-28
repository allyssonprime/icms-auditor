import { describe, expect, it } from 'vitest';
import { buildReconciliacao } from '../reconciliacao.ts';
import { validarNfe } from '../validator.ts';
import { makeConfig, makeDest, makeItem, makeNfe } from './fixtures.ts';

describe('buildReconciliacao', () => {
  it('usa CAMEX 2,10% por CNPJ cadastrado como recolhimento principal', () => {
    const config = makeConfig({
      listaCamex210: ['11.111.111/0001-11'],
    });
    const nfe = makeNfe({
      dest: makeDest({ cnpj: '11111111000111', uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({
        cfop: '5101',
        cstOrig: '6',
        cst: '090',
        pICMS: 12,
        vBC: 1000,
        vICMS: 120,
      })],
    });

    const result = validarNfe(nfe, config);
    const reconciliacao = buildReconciliacao([result], undefined, config);

    expect(reconciliacao.totalGeralICMSRecolher).toBeCloseTo(21, 2);
    expect(reconciliacao.totalGeralRecolherComFundos).toBeCloseTo(25, 2);
    expect(reconciliacao.porTTD[0]?.totalICMSRecolher).toBeCloseTo(21, 2);
    expect(reconciliacao.porTTD[0]?.cargaEfetiva).toBeCloseTo(2.1, 2);
    expect(reconciliacao.porTTD[0]?.refTTD).toBe('1.2.d / 1.13.a');
    expect(reconciliacao.porTTD[0]?.cenarios).toEqual(['B2']);
  });

  it('inclui 1.2.b.1 na referência de PJ não contribuinte interno', () => {
    const config = makeConfig();
    const nfe = makeNfe({
      dest: makeDest({ cnpj: '22222222000122', uf: 'SC', indIEDest: '9', ie: '' }),
      itens: [makeItem({
        cfop: '5101',
        cstOrig: '1',
        cst: '000',
        pICMS: 17,
        vBC: 1000,
        vICMS: 170,
      })],
    });

    const result = validarNfe(nfe, config);
    const reconciliacao = buildReconciliacao([result], undefined, config);

    expect(reconciliacao.porTTD[0]?.cenarios).toEqual(['B6']);
    expect(reconciliacao.porTTD[0]?.refTTD).toBe('1.2.b.1 + 1.14.b');
  });
});
