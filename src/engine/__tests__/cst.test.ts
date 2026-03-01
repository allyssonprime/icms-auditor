import { describe, it, expect } from 'vitest';
import { validarCST } from '../cst.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem } from './fixtures.ts';

describe('validarCST', () => {
  it('should accept CST 090 for interstate (A1)', () => {
    const item = makeItem({ cst: '090' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should reject CST 051 for interstate (A1 expects 90)', () => {
    const item = makeItem({ cst: '051' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('ERRO');
  });

  it('should accept CST 051 for internal with deferral (B1)', () => {
    const item = makeItem({ cst: '051' });
    const result = validarCST(item, CENARIOS['B1']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CST 000 for PF internal (B7)', () => {
    const item = makeItem({ cst: '000' });
    const result = validarCST(item, CENARIOS['B7']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CST 010 for SN with ST (B4)', () => {
    const item = makeItem({ cst: '010' });
    const result = validarCST(item, CENARIOS['B4']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CST 070 for SN with ST (B4)', () => {
    const item = makeItem({ cst: '070' });
    const result = validarCST(item, CENARIOS['B4']!);
    expect(result.status).toBe('OK');
  });

  it('should handle different origin digits', () => {
    const item = makeItem({ cst: '690' }); // origin 6, trib 90
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });
});
