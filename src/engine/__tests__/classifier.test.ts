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

  it('A8: interstate + copper/steel + contributor', () => {
    const item = makeItem({ ncm: '74011000', cfop: '6101', cst: '090' });
    const dest = makeDest({ uf: 'SP', indIEDest: '1' });
    expect(classificarCenario(item, dest, config)).toBe('A8');
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

  it('B3: internal + industrial', () => {
    const cfg = makeConfig({ listaIndustriais: ['12345678000199'] });
    const item = makeItem({ cfop: '5101' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', cnpj: '12345678000199' });
    expect(classificarCenario(item, dest, cfg)).toBe('B3');
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
