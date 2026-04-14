import { describe, it, expect } from 'vitest';
import { crossValidate } from '../crossValidator';
import { makeNfe } from './fixtures';
import type { EfdData, EfdC100 } from '../../types/efd';

function makeEfdC100(overrides: Partial<EfdC100> = {}): EfdC100 {
  return {
    indOper: '1',
    indEmit: '0',
    codSit: '00',
    numDoc: '47611',
    serie: '001',
    chvNfe: '42260308214494000119550010000476111014848505',
    dtDoc: '02/03/2026',
    vlDoc: 156795.43,
    vlBcIcms: 151859.98,
    vlIcms: 15186.0,
    c110Texts: [],
    c113Refs: [],
    c190Items: [],
    isCancelado: false,
    hasTtd: true,
    isEstornada: false,
    estornadaPor: null,
    isEstorno: false,
    nfReferenciada: null,
    ...overrides,
  };
}

function makeEfdData(c100s: EfdC100[], e110VlTotDebitos?: number): EfdData {
  return {
    company: {
      cnpj: '08214494000119',
      nome: 'EMPRESA TESTE',
      uf: 'SC',
      competencia: '03/2026',
      dtIni: '01/03/2026',
      dtFin: '31/03/2026',
    },
    c100s,
    e110: e110VlTotDebitos !== undefined
      ? { vlTotDebitos: e110VlTotDebitos, vlTotCreditos: 0, vlSldApurado: 0, vlIcmsRecolher: 0, vlSldCredorTransportar: 0 }
      : null,
    stats: {
      totalC100: c100s.length,
      c100Saidas: c100s.filter(c => c.indOper === '1').length,
      c100Entradas: c100s.filter(c => c.indOper === '0').length,
      c100Cancelados: c100s.filter(c => c.isCancelado).length,
      c110ComTtd: c100s.filter(c => c.hasTtd).length,
      c113Count: c100s.reduce((sum, c) => sum + c.c113Refs.length, 0),
    },
  };
}

describe('crossValidate', () => {
  it('matches NFs by chave de acesso', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      serie: '1',
      totais: { vBC: 151859.98, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 156795.43, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 156795.43 },
      infCpl: 'TTD test',
    });
    const efd = makeEfdData([makeEfdC100({ chvNfe: chave })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.matched).toBe(1);
    expect(result.onlyXml).toBe(0);
    expect(result.onlyEfd).toBe(0);
    expect(result.valueDivergent).toBe(0);
    expect(result.matches[0]!.matchStatus).toBe('matched');
  });

  it('matches NFs by numero+serie fallback when chave differs', () => {
    const xml = makeNfe({
      chaveAcesso: 'DIFFERENT_CHAVE_44_DIGITS_XXXXXXXXXXXXXXXXXXXXXX',
      numero: '47611',
      serie: '001',
      totais: { vBC: 151859.98, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 156795.43, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 156795.43 },
    });
    const efd = makeEfdData([makeEfdC100({ chvNfe: 'OTHER_CHAVE', numDoc: '47611', serie: '001' })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.matched).toBe(1);
  });

  it('detects only_xml entries', () => {
    const xml = makeNfe({ numero: '99999', chaveAcesso: 'UNIQUE_CHAVE_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' });
    const efd = makeEfdData([makeEfdC100({ numDoc: '47611' })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.onlyXml).toBe(1);
    expect(result.onlyEfd).toBe(1);
    expect(result.matches.find(m => m.matchStatus === 'only_xml')!.numDoc).toBe('99999');
  });

  it('detects only_efd entries', () => {
    const efd = makeEfdData([makeEfdC100({ numDoc: '47611' })]);

    const result = crossValidate([], new Set(), efd);

    expect(result.onlyEfd).toBe(1);
    expect(result.totalXml).toBe(0);
    expect(result.totalEfd).toBe(1);
  });

  it('detects value divergence beyond tolerance', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      totais: { vBC: 151859.98, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 },
    });
    const efd = makeEfdData([makeEfdC100({
      chvNfe: chave,
      vlBcIcms: 151860.05, // diff = 0.07, above 0.02 tolerance
      vlIcms: 15186.0,
    })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.valueDivergent).toBe(1);
    expect(result.matched).toBe(0);
    expect(result.matches[0]!.matchStatus).toBe('value_divergent');
    expect(result.matches[0]!.diffBcIcms).toBeCloseTo(0.07);
  });

  it('accepts value difference within tolerance', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      totais: { vBC: 151860.00, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 },
    });
    const efd = makeEfdData([makeEfdC100({
      chvNfe: chave,
      vlBcIcms: 151860.01, // diff = 0.01, within 0.02 tolerance
      vlIcms: 15186.0,
    })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.matched).toBe(1);
    expect(result.valueDivergent).toBe(0);
  });

  it('skips value comparison for cancelled NFs (EFD zeros values)', () => {
    const chave = '42260308214494000119550010000476111014848505';
    // XML has original values, but NF is cancelled in EFD (COD_SIT=02 → values=0)
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      totais: { vBC: 151860.0, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 156795.43, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 156795.43 },
    });
    const efd = makeEfdData([makeEfdC100({
      chvNfe: chave,
      isCancelado: true,
      vlBcIcms: 0,
      vlIcms: 0,
      vlDoc: 0,
    })]);

    const result = crossValidate([xml], new Set(), efd);

    // Should NOT be divergent — cancelled NFs legitimately have zeroed values
    expect(result.valueDivergent).toBe(0);
    expect(result.matched).toBe(1);
    expect(result.matches[0]!.matchStatus).toBe('matched');
  });

  it('skips value comparison when XML filename indicates cancelada', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      totais: { vBC: 151860.0, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 },
    });
    const canceladasSet = new Set([chave]);
    const efd = makeEfdData([makeEfdC100({ chvNfe: chave, vlBcIcms: 151860.0, vlIcms: 15186.0 })]);

    const result = crossValidate([xml], canceladasSet, efd);

    expect(result.valueDivergent).toBe(0);
    expect(result.matched).toBe(1);
  });

  it('detects cancelada flag divergence', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      totais: { vBC: 0, vICMS: 0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 },
    });
    // XML says cancelada, EFD says regular
    const canceladasSet = new Set([chave]);
    const efd = makeEfdData([makeEfdC100({ chvNfe: chave, isCancelado: false, vlBcIcms: 0, vlIcms: 0 })]);

    const result = crossValidate([xml], canceladasSet, efd);

    const match = result.matches[0]!;
    expect(match.flagDivergences).toContain('cancelada');
    expect(match.xmlCancelada).toBe(true);
    expect(match.efdCancelado).toBe(false);
  });

  it('detects TTD flag divergence', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      infCpl: 'Informacao sem beneficio',
      totais: { vBC: 151860.0, vICMS: 15186.0, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 },
    });
    const efd = makeEfdData([makeEfdC100({ chvNfe: chave, hasTtd: true, vlBcIcms: 151860.0, vlIcms: 15186.0 })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.matches[0]!.flagDivergences).toContain('ttd');
    expect(result.matches[0]!.xmlHasTtd).toBe(false);
    expect(result.matches[0]!.efdHasTtd).toBe(true);
  });

  it('compares totals: XML ICMS sum vs E110.vlTotDebitos', () => {
    const chave1 = '42260308214494000119550010000476111014848505';
    const chave2 = '42260308214494000119550010000476121014848506';
    const xmls = [
      makeNfe({ chaveAcesso: chave1, numero: '47611', totais: { vBC: 100000, vICMS: 10000, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 } }),
      makeNfe({ chaveAcesso: chave2, numero: '47612', totais: { vBC: 50000, vICMS: 5000, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 } }),
    ];
    const efd = makeEfdData([
      makeEfdC100({ chvNfe: chave1, numDoc: '47611', vlBcIcms: 100000, vlIcms: 10000 }),
      makeEfdC100({ chvNfe: chave2, numDoc: '47612', vlBcIcms: 50000, vlIcms: 5000 }),
    ], 20000);

    const result = crossValidate(xmls, new Set(), efd);

    expect(result.xmlTotalDebitos).toBe(15000);
    expect(result.efdTotalDebitos).toBe(20000);
    expect(result.diffTotalDebitos).toBe(5000);
  });

  it('ignores EFD entradas (indOper=0) from comparison', () => {
    const efd = makeEfdData([
      makeEfdC100({ indOper: '0', numDoc: '99999' }), // entrada — should be ignored
    ]);

    const result = crossValidate([], new Set(), efd);

    expect(result.totalEfd).toBe(0); // entrada not counted
    expect(result.onlyEfd).toBe(0);
  });

  it('ignores EFD terceiros (indEmit=1) from comparison', () => {
    const efd = makeEfdData([
      makeEfdC100({ indEmit: '1', numDoc: '99999' }), // terceiros — should be ignored
    ]);

    const result = crossValidate([], new Set(), efd);

    expect(result.totalEfd).toBe(0);
  });

  it('is consistent when all match without divergences', () => {
    const chave = '42260308214494000119550010000476111014848505';
    const xml = makeNfe({
      chaveAcesso: chave,
      numero: '47611',
      infCpl: 'TTD',
      totais: { vBC: 100000, vICMS: 10000, vBCST: 0, vST: 0, vProd: 0, vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0 },
    });
    const efd = makeEfdData([makeEfdC100({ chvNfe: chave, vlBcIcms: 100000, vlIcms: 10000 })]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.isConsistent).toBe(true);
  });

  it('is not consistent when there are only_xml entries', () => {
    const xml = makeNfe({ chaveAcesso: 'UNIQUE_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' });
    const efd = makeEfdData([]);

    const result = crossValidate([xml], new Set(), efd);

    expect(result.isConsistent).toBe(false);
  });

  it('handles empty inputs gracefully', () => {
    const efd = makeEfdData([]);
    const result = crossValidate([], new Set(), efd);

    expect(result.totalXml).toBe(0);
    expect(result.totalEfd).toBe(0);
    expect(result.matched).toBe(0);
    expect(result.matches).toHaveLength(0);
    expect(result.isConsistent).toBe(true);
  });
});
