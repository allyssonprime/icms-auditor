import { describe, it, expect } from 'vitest';
import { verificarVedacoes } from '../vedacoes.ts';
import { makeItem, makeNfe, makeDest, makeConfig } from './fixtures.ts';

describe('verificarVedacoes', () => {
  const config = makeConfig();
  const nfe = makeNfe();

  it('should flag NCM from Decreto 2.128 (V01)', () => {
    const item = makeItem({ ncm: '22071000' }); // matches '220710'
    const results = verificarVedacoes(item, nfe, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });

  it('should flag vidros float (7005)', () => {
    const item = makeItem({ ncm: '70051010' });
    const results = verificarVedacoes(item, nfe, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01');
  });

  it('should flag gas de petroleo (2711)', () => {
    const item = makeItem({ ncm: '27111100' });
    const results = verificarVedacoes(item, nfe, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01');
  });

  it('should not flag non-blocked NCM', () => {
    const item = makeItem({ ncm: '84713019' });
    const results = verificarVedacoes(item, nfe, config);
    expect(results).toHaveLength(0);
  });

  it('should flag used goods CFOP (V02)', () => {
    const item = makeItem({ cfop: '5922' });
    const results = verificarVedacoes(item, nfe, config);
    expect(results.some(r => r.regra === 'V02')).toBe(true);
  });

  it('should flag multiple violations', () => {
    const item = makeItem({ ncm: '27111100', cfop: '5922' });
    const results = verificarVedacoes(item, nfe, config);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});

describe('V01-EXC: Decreto 2.128 exceção operação interna SC×SC', () => {
  const config = makeConfig();

  it('NCM proibida + SC×SC + 12% + sem CP → ALERTA (V01-EXC)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 12, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('ALERTA');
  });

  it('NCM proibida + SC×SC + 17% + sem CP → ALERTA (V01-EXC)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 17, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('ALERTA');
  });

  it('NCM proibida + SC×SC + 12% + com CP → ERRO (V01, uso indevido do TTD)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 12, cCredPresumido: 'CP123' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });

  it('NCM proibida + SC×PR (interestadual) → ERRO (V01)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 12, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'PR' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });

  it('NCM proibida + SC×SC + 4% + sem CP → ERRO (V01, alíquota baixa)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 4, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });
});
