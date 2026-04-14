import { describe, it, expect } from 'vitest';
import { validarNfe } from '../validator.ts';
import { buildApuracaoTTD, emptyOverrideMap, type CamexOverrideMap } from '../apuracaoTTD.ts';
import { makeNfe, makeItem, makeDest, makeConfig } from './fixtures.ts';
import { getDefaultRegras } from '../../data/defaultRegras.ts';

const REGRAS = getDefaultRegras();

function validar(nfes: ReturnType<typeof makeNfe>[]) {
  const config = makeConfig();
  return nfes.map(nfe => validarNfe(nfe, config));
}

describe('buildApuracaoTTD — agrupamento por carga', () => {
  it('NF interna 4% sem reducao -> carga 1,0 / interna / sem_reducao', () => {
    const nfe = makeNfe({
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, cfop: '5101' })],
    });
    const config = makeConfig();
    const results = validar([nfe]);
    const ap = buildApuracaoTTD(results, REGRAS, config, emptyOverrideMap());

    const c1 = ap.cargas.find(c => c.carga === 1.0)!;
    expect(c1).toBeDefined();
    expect(c1.totalBC).toBeCloseTo(1000, 2);
    expect(c1.totalVICMS).toBeCloseTo(40, 2);
    // CP = 40 - 1000*0.01 = 30
    expect(c1.totalCP).toBeCloseTo(30, 2);

    expect(c1.operacoes).toHaveLength(1);
    expect(c1.operacoes[0]!.tipo).toBe('interna');
    expect(c1.operacoes[0]!.subgrupos).toHaveLength(1);
    expect(c1.operacoes[0]!.subgrupos[0]!.reducaoBC).toBe('sem_reducao');
    expect(c1.operacoes[0]!.subgrupos[0]!.linhas).toHaveLength(1);
  });

  it('NF interestadual 4% -> subgrupo interestadual aparece', () => {
    const nfes = [
      makeNfe({
        chaveAcesso: 'A',
        dhEmi: '2026-03-02T10:00:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, cfop: '6101' })],
      }),
      makeNfe({
        chaveAcesso: 'B',
        dhEmi: '2026-03-02T11:00:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 4, vBC: 500, vICMS: 20, cfop: '5101' })],
      }),
    ];
    const ap = buildApuracaoTTD(validar(nfes), REGRAS, makeConfig(), emptyOverrideMap());
    const c1 = ap.cargas.find(c => c.carga === 1.0)!;
    expect(c1.operacoes.map(o => o.tipo)).toEqual(['interna', 'interestadual']);
    expect(c1.operacoes.find(o => o.tipo === 'interna')!.totalBC).toBeCloseTo(500, 2);
    expect(c1.operacoes.find(o => o.tipo === 'interestadual')!.totalBC).toBeCloseTo(1000, 2);
  });

  it('NF interestadual ausente -> sem subgrupo interestadual', () => {
    const nfe = makeNfe({
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, cfop: '5101' })],
    });
    const ap = buildApuracaoTTD(validar([nfe]), REGRAS, makeConfig(), emptyOverrideMap());
    const c1 = ap.cargas.find(c => c.carga === 1.0)!;
    expect(c1.operacoes.map(o => o.tipo)).toEqual(['interna']);
  });

  it('NF com itens em aliquotas diferentes -> 2 linhas, ambas com temItensOutrasCargas', () => {
    const nfe = makeNfe({
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [
        makeItem({ nItem: '1', pICMS: 4, vBC: 1000, vICMS: 40, cfop: '5101' }),
        makeItem({ nItem: '2', pICMS: 10, vBC: 2000, vICMS: 200, cfop: '5101' }),
      ],
    });
    const ap = buildApuracaoTTD(validar([nfe]), REGRAS, makeConfig(), emptyOverrideMap());

    const c1 = ap.cargas.find(c => c.carga === 1.0)!;
    const c36 = ap.cargas.find(c => c.carga === 3.6)!;
    expect(c1.totalBC).toBeCloseTo(1000, 2);
    expect(c36.totalBC).toBeCloseTo(2000, 2);

    const todasLinhas = [
      ...c1.operacoes.flatMap(o => o.subgrupos.flatMap(sg => sg.linhas)),
      ...c36.operacoes.flatMap(o => o.subgrupos.flatMap(sg => sg.linhas)),
    ];
    expect(todasLinhas).toHaveLength(2);
    expect(todasLinhas.every(l => l.temItensOutrasCargas)).toBe(true);
  });

  it('item com pRedBC > 0 -> subgrupo com_reducao, BC integral correta', () => {
    const nfe = makeNfe({
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({
        pICMS: 17, vBC: 500, pRedBC: 50, vProd: 1000, vICMS: 85, cfop: '5101',
      })],
    });
    const ap = buildApuracaoTTD(validar([nfe]), REGRAS, makeConfig(), emptyOverrideMap());
    const c36 = ap.cargas.find(c => c.carga === 3.6)!;
    expect(c36.operacoes[0]!.subgrupos).toHaveLength(1);
    expect(c36.operacoes[0]!.subgrupos[0]!.reducaoBC).toBe('com_reducao');
    // BC integral = 1000 (vBC=500 / (1-0.5)); CP = 85 - 1000*0.036 = 49
    expect(c36.totalBC).toBeCloseTo(1000, 2);
    expect(c36.totalCP).toBeCloseTo(49, 2);
  });

  it('vCP por linha = vICMS - bcIntegral × cargaEfetiva', () => {
    const nfe = makeNfe({
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({ pICMS: 10, vBC: 1000, vICMS: 100, cfop: '5101' })],
    });
    const ap = buildApuracaoTTD(validar([nfe]), REGRAS, makeConfig(), emptyOverrideMap());
    const c36 = ap.cargas.find(c => c.carga === 3.6)!;
    const linha = c36.operacoes[0]!.subgrupos[0]!.linhas[0]!;
    // vICMS=100, bcIntegral=1000, carga=3.6 -> vICMS esp = 36 -> CP = 64
    expect(linha.vCP).toBeCloseTo(64, 2);
  });

  it('totais globais = soma dos buckets de carga', () => {
    const nfes = [
      makeNfe({
        chaveAcesso: 'A',
        dhEmi: '2026-03-02T10:00:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, cfop: '5101' })],
      }),
      makeNfe({
        chaveAcesso: 'B',
        dhEmi: '2026-03-03T10:00:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 10, vBC: 2000, vICMS: 200, cfop: '5101' })],
      }),
    ];
    const ap = buildApuracaoTTD(validar(nfes), REGRAS, makeConfig(), emptyOverrideMap());
    expect(ap.totalBCGlobal).toBeCloseTo(3000, 2);
    expect(ap.totalVICMSGlobal).toBeCloseTo(240, 2);
    // CP global = (40 - 10) + (200 - 72) = 30 + 128 = 158
    expect(ap.totalCPGlobal).toBeCloseTo(158, 2);
  });

  it('filtra por periodo (AAAA-MM)', () => {
    const nfes = [
      makeNfe({
        chaveAcesso: 'A',
        dhEmi: '2026-03-02T10:00:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, cfop: '5101' })],
      }),
      makeNfe({
        chaveAcesso: 'B',
        dhEmi: '2026-04-15T10:00:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 4, vBC: 999, vICMS: 39.96, cfop: '5101' })],
      }),
    ];
    const ap = buildApuracaoTTD(validar(nfes), REGRAS, makeConfig(), emptyOverrideMap(), '2026-03');
    expect(ap.periodo).toBe('2026-03');
    expect(ap.totalBCGlobal).toBeCloseTo(1000, 2);
  });

  it('fundos sao calculados a partir dos totais', () => {
    const nfe = makeNfe({
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({ pICMS: 10, vBC: 100_000, vICMS: 10_000, cfop: '5101' })],
    });
    const ap = buildApuracaoTTD(validar([nfe]), REGRAS, makeConfig(), emptyOverrideMap());
    // BC=100.000, CP=10.000-3.600=6.400
    expect(ap.fundos.fundec).toBeCloseTo(50, 2); // 0,05% × 100.000
    expect(ap.fundos.fumdes).toBeCloseTo(128, 2); // 2% × 6.400
    // Fundo Social = max(0, 0,4% × 100.000 − 128) = max(0, 400 − 128) = 272
    expect(ap.fundos.fundoSocial).toBeCloseTo(272, 2);
    expect(ap.fundos.proEmprego).toBe(0);
  });
});

describe('buildApuracaoTTD — overrides CAMEX', () => {
  function nfeCamex(chave: string, ncm = '85423190'): ReturnType<typeof makeNfe> {
    return makeNfe({
      chaveAcesso: chave,
      numero: chave,
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1', cnpj: '11111111000111' }),
      itens: [makeItem({
        ncm, cstOrig: '6', pICMS: 12, vBC: 1000, vICMS: 120, cfop: '5101',
      })],
    });
  }

  it('CAMEX 12% sem override -> carga 3,6 CAMEX (default)', () => {
    const config = makeConfig({ listaCamex: ['85423190'] });
    const result = validarNfe(nfeCamex('NFCAMEX1'), config);
    const ap = buildApuracaoTTD([result], REGRAS, config, emptyOverrideMap());
    const c36camex = ap.cargas.find(c => c.carga === 3.6 && c.isCAMEX)!;
    expect(c36camex).toBeDefined();
    expect(c36camex.totalBC).toBeCloseTo(1000, 2);
    // bucket 2,1 nao deve existir (esta vazio, foi filtrado)
    expect(ap.cargas.find(c => c.carga === 2.1)).toBeUndefined();
    // bucket 3,6 sem CAMEX tambem nao deve existir
    expect(ap.cargas.find(c => c.carga === 3.6 && !c.isCAMEX)).toBeUndefined();
    const linha = c36camex.operacoes[0]!.subgrupos[0]!.linhas[0]!;
    expect(linha.origemCAMEX).toBe('auto_default');
    expect(linha.isCAMEX).toBe(true);
  });

  it('override por chave para 2,1 -> bucket 2,1 com origem manual_nf', () => {
    const config = makeConfig({ listaCamex: ['85423190'] });
    const result = validarNfe(nfeCamex('NFCAMEX2'), config);
    const overrides: CamexOverrideMap = {
      byChave: new Map([['NFCAMEX2', { carga: 2.1, origem: 'manual_nf' }]]),
      byPar: new Map(),
    };
    const ap = buildApuracaoTTD([result], REGRAS, config, overrides);
    expect(ap.cargas.find(c => c.carga === 3.6)).toBeUndefined();
    const c21 = ap.cargas.find(c => c.carga === 2.1 && c.isCAMEX)!;
    expect(c21).toBeDefined();
    expect(c21.totalBC).toBeCloseTo(1000, 2);
    const linha = c21.operacoes[0]!.subgrupos[0]!.linhas[0]!;
    expect(linha.origemCAMEX).toBe('manual_nf');
  });

  it('override por par (cnpjDest+ncm) para 2,1 -> bucket 2,1 com origem manual_par', () => {
    const config = makeConfig({ listaCamex: ['85423190'] });
    const result = validarNfe(nfeCamex('NFCAMEX3', '85423190'), config);
    const overrides: CamexOverrideMap = {
      byChave: new Map(),
      byPar: new Map([['11111111000111_85423190', { carga: 2.1, origem: 'manual_par' }]]),
    };
    const ap = buildApuracaoTTD([result], REGRAS, config, overrides);
    const c21 = ap.cargas.find(c => c.carga === 2.1 && c.isCAMEX)!;
    expect(c21).toBeDefined();
    expect(c21.totalBC).toBeCloseTo(1000, 2);
    const linha = c21.operacoes[0]!.subgrupos[0]!.linhas[0]!;
    expect(linha.origemCAMEX).toBe('manual_par');
  });

  it('override por chave tem prioridade sobre override por par', () => {
    // chave aponta para 3,6 (mesmo do default — distinguivel pela origem),
    // par aponta para 2,1. A chave deve vencer.
    const config = makeConfig({ listaCamex: ['85423190'] });
    const result = validarNfe(nfeCamex('NFCAMEX4', '85423190'), config);
    const overrides: CamexOverrideMap = {
      byChave: new Map([['NFCAMEX4', { carga: 3.6, origem: 'manual_nf' }]]),
      byPar: new Map([['11111111000111_85423190', { carga: 2.1, origem: 'manual_par' }]]),
    };
    const ap = buildApuracaoTTD([result], REGRAS, config, overrides);
    expect(ap.cargas.find(c => c.carga === 2.1)).toBeUndefined();
    const c36 = ap.cargas.find(c => c.carga === 3.6 && c.isCAMEX)!;
    expect(c36).toBeDefined();
    expect(c36.totalBC).toBeCloseTo(1000, 2);
    expect(c36.operacoes[0]!.subgrupos[0]!.linhas[0]!.origemCAMEX).toBe('manual_nf');
  });

  it('NF CAMEX 12% e NF nao-CAMEX 10% caem em buckets 3,6 distintos', () => {
    const config = makeConfig({ listaCamex: ['85423190'] });
    const nfeCAMEX12 = makeNfe({
      chaveAcesso: 'NFAA',
      numero: 'NFAA',
      dhEmi: '2026-03-02T10:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1', cnpj: '11111111000111' }),
      itens: [makeItem({ ncm: '85423190', cstOrig: '6', pICMS: 12, vBC: 1000, vICMS: 120, cfop: '5101' })],
    });
    const nfeNormal10 = makeNfe({
      chaveAcesso: 'NFBB',
      numero: 'NFBB',
      dhEmi: '2026-03-02T11:00:00',
      dest: makeDest({ uf: 'SC', indIEDest: '1', cnpj: '22222222000122' }),
      itens: [makeItem({ ncm: '11111111', cstOrig: '0', pICMS: 10, vBC: 2000, vICMS: 200, cfop: '5101' })],
    });
    const results = [
      validarNfe(nfeCAMEX12, config),
      validarNfe(nfeNormal10, config),
    ];
    const ap = buildApuracaoTTD(results, REGRAS, config, emptyOverrideMap());
    const c36camex = ap.cargas.find(c => c.carga === 3.6 && c.isCAMEX);
    const c36normal = ap.cargas.find(c => c.carga === 3.6 && !c.isCAMEX);
    expect(c36camex).toBeDefined();
    expect(c36normal).toBeDefined();
    expect(c36camex!.totalBC).toBeCloseTo(1000, 2);
    expect(c36normal!.totalBC).toBeCloseTo(2000, 2);
    expect(c36camex!.aliquotaLabel).toContain('CAMEX');
    expect(c36camex!.isCAMEX).toBe(true);
    expect(c36normal!.isCAMEX).toBe(false);
    expect(c36normal!.aliquotaLabel).toContain('sem CAMEX');
  });

  it('ordem dos blocos: 1.0 nao-CAMEX → 2.1 CAMEX → 3.6 CAMEX → 3.6 nao-CAMEX', () => {
    const config = makeConfig({ listaCamex: ['85423190'] });
    const nfes = [
      // 3,6 nao-CAMEX
      makeNfe({
        chaveAcesso: 'A', numero: 'A', dhEmi: '2026-03-02T10:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 10, vBC: 1, vICMS: 0.1, cfop: '5101' })],
      }),
      // 1,0 nao-CAMEX
      makeNfe({
        chaveAcesso: 'B', numero: 'B', dhEmi: '2026-03-02T11:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1' }),
        itens: [makeItem({ pICMS: 4, vBC: 1, vICMS: 0.04, cfop: '5101' })],
      }),
      // 2,1 CAMEX (override)
      makeNfe({
        chaveAcesso: 'C', numero: 'C', dhEmi: '2026-03-02T12:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1', cnpj: '11111111000111' }),
        itens: [makeItem({ ncm: '85423190', cstOrig: '6', pICMS: 12, vBC: 1, vICMS: 0.12, cfop: '5101' })],
      }),
      // 3,6 CAMEX (default)
      makeNfe({
        chaveAcesso: 'D', numero: 'D', dhEmi: '2026-03-02T13:00',
        dest: makeDest({ uf: 'SC', indIEDest: '1', cnpj: '33333333000133' }),
        itens: [makeItem({ ncm: '85423190', cstOrig: '6', pICMS: 12, vBC: 1, vICMS: 0.12, cfop: '5101' })],
      }),
    ];
    const overrides: CamexOverrideMap = {
      byChave: new Map([['C', { carga: 2.1, origem: 'manual_nf' }]]),
      byPar: new Map(),
    };
    const ap = buildApuracaoTTD(nfes.map(n => validarNfe(n, config)), REGRAS, config, overrides);
    // Ordem esperada: (1.0,N), (2.1,C), (3.6,C), (3.6,N)
    const ordem = ap.cargas.map(c => `${c.carga}_${c.isCAMEX ? 'C' : 'N'}`);
    expect(ordem).toEqual(['1_N', '2.1_C', '3.6_C', '3.6_N']);
  });
});
