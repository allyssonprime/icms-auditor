import { describe, it, expect } from 'vitest';
import { validarAliquota } from '../aliquota.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem, makeDest, makeConfig } from './fixtures.ts';

describe('validarAliquota', () => {
  const config = makeConfig();

  it('should return OK for correct rate (A1: 4%)', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('should return ERRO for wrong rate (A1: expects 4%, got 12%)', () => {
    const item = makeItem({ pICMS: 12 });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('ERRO');
  });

  it('should resolve CAMEX rate by UF (A2: 12% for SP)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6' });
    const dest = makeDest({ uf: 'SP' });
    const { result } = validarAliquota(item, CENARIOS['A2']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('should resolve CAMEX rate by UF (A2: 7% for BA)', () => {
    const item = makeItem({ pICMS: 7 });
    const dest = makeDest({ uf: 'BA' });
    const { result } = validarAliquota(item, CENARIOS['A2']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('should reject wrong CAMEX rate (A2: 4% for SP)', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'SP' });
    const { result } = validarAliquota(item, CENARIOS['A2']!, dest, config);
    expect(result.status).toBe('ERRO');
  });

  it('should accept any valid internal rate for B5 (SN dest)', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    for (const rate of [7, 8.8, 12, 17, 25]) {
      const item = makeItem({ pICMS: rate });
      const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
      const { result } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
      expect(result.status).toBe('OK');
    }
  });

  it('should handle float tolerance (4.001 ~ 4)', () => {
    const item = makeItem({ pICMS: 4.001 });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('B3: should alert when 4% used instead of 10%', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'SC' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(result.mensagem).toContain('10%');
  });

  it('B3: should accept 10% when dest is industrial', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const industrialConfig = makeConfig({ listaIndustriais: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, industrialConfig);
    expect(result.status).toBe('OK');
  });

  it('B3: should alert 10% when dest is not industrial', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(result.mensagem).toContain('divergencias');
  });
});

describe('cross-checks 12%', () => {
  const config = makeConfig();

  it('12% + CST orig 6 → OK with check ok', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, config);
    expect(result.status).toBe('OK');
    const ck = crossChecks.find(c => c.regra === 'CK12A');
    expect(ck?.ok).toBe(true);
  });

  it('12% + NCM na Camex → OK', () => {
    const camexConfig = makeConfig({ listaCamex: ['8471'] });
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '190' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, camexConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.ok).toBe(true);
  });

  it('12% + SN dest → OK', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12C')?.ok).toBe(true);
  });

  it('12% + NC dest (no CAMEX, no SN) → ALERTA', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.ok).toBe(false);
  });
});

describe('cross-checks 4%', () => {
  const config = makeConfig();

  it('4% + CST orig 1 → checks ok', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '151' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { crossChecks } = validarAliquota(item, CENARIOS['B1']!, dest, config);
    expect(crossChecks.find(c => c.regra === 'CK04C')?.ok).toBe(true);
    expect(crossChecks.find(c => c.regra === 'CK04B')?.ok).toBe(true);
  });

  it('4% + CST orig 6 → CK04B divergente', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '6', cst: '651' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B1']!, dest, config);
    expect(crossChecks.find(c => c.regra === 'CK04B')?.ok).toBe(false);
    expect(result.status).toBe('ALERTA');
  });

  it('4% + SN dest (B5) → CK04A divergente', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    // B5 does not accept 4% → ERRO, but cross-checks still run
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
    expect(result.status).toBe('ERRO');
    expect(crossChecks.find(c => c.regra === 'CK04A')?.ok).toBe(false);
  });

  it('4% + SN dest (B4 exception) → CK04A ok', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '110' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B4']!, dest, snConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK04A')?.ok).toBe(true);
  });
});

describe('cross-checks 17%', () => {
  it('17% + BC reduzida (pRedBC) → OK', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '120', pRedBC: 48, vBC: 520, vProd: 1000 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK17A')?.ok).toBe(true);
  });

  it('17% + SN → OK', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK17B')?.ok).toBe(true);
  });

  it('17% + NC → OK', () => {
    const config = makeConfig();
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK17C')?.ok).toBe(true);
  });

  it('17% + BC cheia + contribuinte normal → ALERTA', () => {
    const config = makeConfig();
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    // B5 needs SN, but for this test we use B5 directly to check the cross-check
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(crossChecks.find(c => c.regra === 'CK17A')?.ok).toBe(false);
    expect(crossChecks.find(c => c.regra === 'CK17B')?.ok).toBe(false);
    expect(crossChecks.find(c => c.regra === 'CK17C')?.ok).toBe(false);
  });
});
