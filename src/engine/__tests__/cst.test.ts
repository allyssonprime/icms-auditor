import { describe, it, expect } from 'vitest';
import { validarCST } from '../cst.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem } from './fixtures.ts';

describe('validarCST', () => {
  // === TRIBUTACAO: 00, 51, 90 sao todos aceitos sem distincao ===

  it('should accept CST 190 (orig 1, trib 90) for A1', () => {
    const item = makeItem({ cstOrig: '1', cst: '190' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CST 151 (orig 1, trib 51) for A1 — no difference', () => {
    const item = makeItem({ cstOrig: '1', cst: '151' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CST 100 (orig 1, trib 00) for A1 — no difference', () => {
    const item = makeItem({ cstOrig: '1', cst: '100' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
  });

  it('should accept CST 100 for B1 — 00 and 51 are interchangeable', () => {
    const item = makeItem({ cstOrig: '1', cst: '100' });
    const result = validarCST(item, CENARIOS['B1']!);
    expect(result.status).toBe('OK');
  });

  // === ORIGEM ===

  it('should accept origin 6 (CAMEX - sem similar)', () => {
    const item = makeItem({ cstOrig: '6', cst: '690' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
    expect(result.mensagem).toContain('CAMEX');
  });

  it('should accept origin 7 (CAMEX - adquirida sem similar)', () => {
    const item = makeItem({ cstOrig: '7', cst: '790' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('OK');
    expect(result.mensagem).toContain('CAMEX');
  });

  it('should alert for origin 0 (nacional) on imported goods', () => {
    const item = makeItem({ cstOrig: '0', cst: '090' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('ALERTA');
    expect(result.regra).toBe('CST02');
  });

  it('should alert for origin 3 (nacional com conteudo importado > 40%)', () => {
    const item = makeItem({ cstOrig: '3', cst: '390' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('ALERTA');
    expect(result.regra).toBe('CST02');
  });

  // === TRIBUTACAO ESPECIAL: ST (10) e Reducao BC (20) ===

  it('should accept CST trib 10 (ST) when cenario expects ST', () => {
    const item = makeItem({ cstOrig: '1', cst: '110' });
    const result = validarCST(item, CENARIOS['B4']!); // B4 expects 10, 70
    expect(result.status).toBe('OK');
  });

  it('should alert CST trib 10 (ST) when cenario does NOT expect ST', () => {
    const item = makeItem({ cstOrig: '1', cst: '110' });
    const result = validarCST(item, CENARIOS['A1']!); // A1 doesn't expect ST
    expect(result.status).toBe('ALERTA');
    expect(result.regra).toBe('CST03');
  });

  it('should alert CST trib 20 (reducao BC) always', () => {
    const item = makeItem({ cstOrig: '1', cst: '120' });
    const result = validarCST(item, CENARIOS['A1']!);
    expect(result.status).toBe('ALERTA');
    expect(result.regra).toBe('CST04');
  });
});
