import { describe, it, expect } from 'vitest';
import { validarCFOP } from '../cfop.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem } from './fixtures.ts';

describe('validarCFOP', () => {
  it('should accept CFOP 6101 for interstate (A1)', () => {
    const item = makeItem({ cfop: '6101' });
    const result = validarCFOP(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CFOP 5101 for internal (B1)', () => {
    const item = makeItem({ cfop: '5101' });
    const result = validarCFOP(item, CENARIOS['B1']!);
    expect(result.status).toBe('OK');
  });

  it('should alert for wrong direction (5101 for interstate A1)', () => {
    const item = makeItem({ cfop: '5101' });
    const result = validarCFOP(item, CENARIOS['A1']!);
    expect(result.status).toBe('AVISO');
  });

  it('should accept transfer CFOP for B12', () => {
    const item = makeItem({ cfop: '5152' });
    const result = validarCFOP(item, CENARIOS['B12']!);
    expect(result.status).toBe('OK');
  });

  it('should accept transfer CFOP for A9', () => {
    const item = makeItem({ cfop: '6152' });
    const result = validarCFOP(item, CENARIOS['A9']!);
    expect(result.status).toBe('OK');
  });

  it('should accept conta e ordem CFOP (6949) as OK', () => {
    const item = makeItem({ cfop: '6949' });
    const result = validarCFOP(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should accept venda CFOP (5102) even for interstate via fallback', () => {
    const item = makeItem({ cfop: '5102' });
    const result = validarCFOP(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should alert for truly unusual CFOP', () => {
    const item = makeItem({ cfop: '6999' });
    const result = validarCFOP(item, CENARIOS['A1']!);
    expect(result.status).toBe('AVISO');
  });
});
