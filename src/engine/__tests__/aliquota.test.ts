import { describe, it, expect } from 'vitest';
import { validarAliquota } from '../aliquota.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem, makeDest } from './fixtures.ts';

describe('validarAliquota', () => {
  it('should return OK for correct rate (A1: 4%)', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'PR' });
    const result = validarAliquota(item, CENARIOS['A1']!, dest);
    expect(result.status).toBe('OK');
  });

  it('should return ERRO for wrong rate (A1: expects 4%, got 12%)', () => {
    const item = makeItem({ pICMS: 12 });
    const dest = makeDest({ uf: 'PR' });
    const result = validarAliquota(item, CENARIOS['A1']!, dest);
    expect(result.status).toBe('ERRO');
  });

  it('should resolve CAMEX rate by UF (A2: 12% for SP)', () => {
    const item = makeItem({ pICMS: 12 });
    const dest = makeDest({ uf: 'SP' });
    const result = validarAliquota(item, CENARIOS['A2']!, dest);
    expect(result.status).toBe('OK');
  });

  it('should resolve CAMEX rate by UF (A2: 7% for BA)', () => {
    const item = makeItem({ pICMS: 7 });
    const dest = makeDest({ uf: 'BA' });
    const result = validarAliquota(item, CENARIOS['A2']!, dest);
    expect(result.status).toBe('OK');
  });

  it('should reject wrong CAMEX rate (A2: 4% for SP)', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'SP' });
    const result = validarAliquota(item, CENARIOS['A2']!, dest);
    expect(result.status).toBe('ERRO');
  });

  it('should accept any valid internal rate for B5', () => {
    for (const rate of [7, 8.8, 12, 17, 25]) {
      const item = makeItem({ pICMS: rate });
      const dest = makeDest({ uf: 'SC' });
      const result = validarAliquota(item, CENARIOS['B5']!, dest);
      expect(result.status).toBe('OK');
    }
  });

  it('should handle float tolerance (4.001 ~ 4)', () => {
    const item = makeItem({ pICMS: 4.001 });
    const dest = makeDest({ uf: 'PR' });
    const result = validarAliquota(item, CENARIOS['A1']!, dest);
    expect(result.status).toBe('OK');
  });

  it('B3: should alert when 4% used instead of 10%', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'SC' });
    const result = validarAliquota(item, CENARIOS['B3']!, dest);
    expect(result.status).toBe('ALERTA');
    expect(result.mensagem).toContain('10%');
  });

  it('B3: should accept 10%', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC' });
    const result = validarAliquota(item, CENARIOS['B3']!, dest);
    expect(result.status).toBe('OK');
  });
});
