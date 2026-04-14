import { describe, it, expect } from 'vitest';
import { classificarCenario } from '../classifier.ts';
import { makeItem, makeDest, makeConfig } from './fixtures.ts';

describe('classificarCenario', () => {
  const config = makeConfig();

  // === INTERESTADUAIS ===

  it('A1: interstate + contributor + non-CAMEX', () => {
    const item = makeItem({ ncm: '84713019', cfop: '6101', cst: '090' });
    const dest = makeDest({ uf: 'PR', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, config)).toBe('A1');
  });

  it('A2: interstate + contributor + CAMEX', () => {
    const cfg = makeConfig({ listaCamex: ['84713019'] });
    const item = makeItem({ ncm: '84713019', cfop: '6101', cst: '090' });
    const dest = makeDest({ uf: 'SP', indIEDest: '1' });
    expect(classificarCenario(item, dest, cfg)).toBe('A2');
  });

  it('A4: interstate + PJ non-contributor', () => {
    const item = makeItem({ cfop: '6107' });
    const dest = makeDest({ uf: 'RJ', indIEDest: '9', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, config)).toBe('A4');
  });

  it('A6: interstate + PF', () => {
    const item = makeItem({ cfop: '6108' });
    const dest = makeDest({ uf: 'MG', cpf: '12345678901', cnpj: undefined, indIEDest: '9' });
    expect(classificarCenario(item, dest, config)).toBe('A6');
  });

  it('A8 desativado v3: cobre/aco interstate cai em A1 (modificador, nao cenario)', () => {
    const cfg = makeConfig({ listaCobreAco: ['7401'] });
    const item = makeItem({ ncm: '74011000', cfop: '6101', cst: '090' });
    const dest = makeDest({ uf: 'SP', indIEDest: '1' });
    expect(classificarCenario(item, dest, cfg)).toBe('A1');
  });

  it('A9: transfer interstate', () => {
    const item = makeItem({ cfop: '6152' });
    const dest = makeDest({ uf: 'SP', indIEDest: '1' });
    expect(classificarCenario(item, dest, config)).toBe('A9');
  });

  // === INTERNAS ===

  it('B1: internal + normal contributor', () => {
    const item = makeItem({ ncm: '84713019', cfop: '5101', cst: '051' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    expect(classificarCenario(item, dest, config)).toBe('B1');
  });

  it('B4: internal + SN + with ST', () => {
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ cfop: '5101', cst: '010' }); // CST ending in 10 = ST
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B4');
  });

  it('B5: internal + SN + without ST', () => {
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ cfop: '5101', cst: '000' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B5');
  });

  it('B6: internal + PJ non-contributor', () => {
    const item = makeItem({ cfop: '5102' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, config)).toBe('B6');
  });

  it('B7: internal + PF', () => {
    const item = makeItem({ cfop: '5102' });
    const dest = makeDest({ uf: 'SC', cpf: '12345678901', cnpj: undefined, indIEDest: '9' });
    expect(classificarCenario(item, dest, config)).toBe('B7');
  });

  it('B9: internal + vedacao 2.5.a', () => {
    const cfg = makeConfig({ listaVedacao25a: ['12345678000199'] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B9');
  });

  it('B10: internal + vedacao 2.5.b textil', () => {
    const cfg = makeConfig({ listaVedacao25b: ['12345678000199'] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B10');
  });

  it('B11: internal + CD exclusivo', () => {
    const cfg = makeConfig({ listaCD: ['12345678000199'] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B11');
  });

  it('B12: transfer internal', () => {
    const item = makeItem({ cfop: '5152' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    expect(classificarCenario(item, dest, config)).toBe('B12');
  });

  it('B3: internal + industrial (non-CAMEX)', () => {
    const cfg = makeConfig({ listaIndustriais: ['12345678000199'] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B3');
  });

  it('B3: internal + CNAE industrial via cnpjInfoMap (fora da listaIndustriais)', () => {
    const cfg = makeConfig({ listaIndustriais: [] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    const cnpjInfoMap = new Map([
      ['12345678000199', { cnpj: '12345678000199', razaoSocial: 'X', simplesOptante: false, isMei: false, cnaePrincipal: '2511', cnaeDescricao: 'Metalúrgica', cnaesSecundarios: [], isIndustrial: true }],
    ]);
    expect(classificarCenario(item, dest, cfg, undefined, undefined, cnpjInfoMap)).toBe('B3');
  });

  it('B1: internal + CNAE NÃO industrial → cai em B1 (sem promoção)', () => {
    const cfg = makeConfig({ listaIndustriais: [] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    const cnpjInfoMap = new Map([
      ['12345678000199', { cnpj: '12345678000199', razaoSocial: 'X', simplesOptante: false, isMei: false, cnaePrincipal: '4711', cnaeDescricao: 'Comércio', cnaesSecundarios: [], isIndustrial: false }],
    ]);
    expect(classificarCenario(item, dest, cfg, undefined, undefined, cnpjInfoMap)).toBe('B1');
  });

  it('B3: listaIndustriais tem precedência sobre CNAE não-industrial', () => {
    const cfg = makeConfig({ listaIndustriais: ['12345678000199'] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    const cnpjInfoMap = new Map([
      ['12345678000199', { cnpj: '12345678000199', razaoSocial: 'X', simplesOptante: false, isMei: false, cnaePrincipal: '4711', cnaeDescricao: 'Comércio', cnaesSecundarios: [], isIndustrial: false }],
    ]);
    expect(classificarCenario(item, dest, cfg, undefined, undefined, cnpjInfoMap)).toBe('B3');
  });

  it('B2-Industrial: internal + industrial + CAMEX → ramificação específica CAMEX+industrial', () => {
    const cfg = makeConfig({ listaIndustriais: ['12345678000199'], listaCamex: ['84713019'] });
    const item = makeItem({ ncm: '84713019', cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B2-Industrial');
  });

  it('B2-Industrial: CST origem 6 (CAMEX) + dest industrial → B2-Industrial (listaCamex vazia)', () => {
    const cfg = makeConfig({ listaIndustriais: ['12345678000199'], listaCamex: [] });
    const item = makeItem({ ncm: '99999999', cstOrig: '6', cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B2-Industrial');
  });

  it('B2: CAMEX sem destinatário industrial → B2 puro', () => {
    const cfg = makeConfig({ listaIndustriais: [], listaCamex: ['84713019'] });
    const item = makeItem({ ncm: '84713019', cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B2');
  });

  it('A2: CST origem 6 (CAMEX) interstate → classified as CAMEX', () => {
    const cfg = makeConfig({ listaCamex: [] });
    const item = makeItem({ ncm: '99999999', cstOrig: '6', cfop: '6101' });
    const dest = makeDest({ uf: 'SP', indIEDest: '1' });
    expect(classificarCenario(item, dest, cfg)).toBe('A2');
  });

  it('A4: interstate + SN in listaSN but NO IE → NC takes priority over SN', () => {
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ cfop: '6101' });
    const dest = makeDest({ uf: 'SP', indIEDest: '9', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('A4');
  });

  it('B6: internal + SN in listaSN but NO IE → NC takes priority over SN', () => {
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ cfop: '5102' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B6');
  });

  it('DEVOLUCAO: return CFOP', () => {
    const item = makeItem({ cfop: '5201' });
    const dest = makeDest({ uf: 'SC' });
    expect(classificarCenario(item, dest, config)).toBe('DEVOLUCAO');
  });

  it('returns DESCONHECIDO for unclassifiable', () => {
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '2', cnpj: undefined, cpf: undefined });
    expect(classificarCenario(item, dest, config)).toBe('DESCONHECIDO');
  });
});
