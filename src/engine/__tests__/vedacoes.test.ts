import { describe, it, expect } from 'vitest';
import { verificarVedacoes } from '../vedacoes.ts';
import { makeItem, makeConfig } from './fixtures.ts';

describe('verificarVedacoes', () => {
  const config = makeConfig();

  it('should flag NCM from Decreto 2.128 (V01)', () => {
    const item = makeItem({ ncm: '22071000' }); // matches '220710'
    const results = verificarVedacoes(item, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });

  it('should flag vidros float (7005)', () => {
    const item = makeItem({ ncm: '70051010' });
    const results = verificarVedacoes(item, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01');
  });

  it('should flag gas de petroleo (2711)', () => {
    const item = makeItem({ ncm: '27111100' });
    const results = verificarVedacoes(item, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01');
  });

  it('should not flag non-blocked NCM', () => {
    const item = makeItem({ ncm: '84713019' });
    const results = verificarVedacoes(item, config);
    expect(results).toHaveLength(0);
  });

  it('should flag used goods CFOP (V02)', () => {
    const item = makeItem({ cfop: '5922' });
    const results = verificarVedacoes(item, config);
    expect(results.some(r => r.regra === 'V02')).toBe(true);
  });

  it('should flag multiple violations', () => {
    const item = makeItem({ ncm: '27111100', cfop: '5922' });
    const results = verificarVedacoes(item, config);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
