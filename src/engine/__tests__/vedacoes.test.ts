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

  it('NCM proibida + SC×SC + 12% + sem CP (apuração mensal) → AVISO (V01-EXC)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 12, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results).toHaveLength(1);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('AVISO');
  });

  it('NCM proibida + SC×SC + 17% + sem CP → AVISO (V01-EXC)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 17, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('AVISO');
  });

  it('NCM proibida + SC×SC + 10% + sem CP → AVISO (V01-EXC, patamar inclui 10%)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 10, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('AVISO');
  });

  it('NCM proibida + SC×SC + 12% + com CP declarado → AVISO (V01-EXC, autorização específica presumida)', () => {
    // Refletindo apuração real: empresas com autorização específica no TTD para
    // NCMs do Decreto 2.128 (ex: vidros 70071900 na Prime) declaram CP no XML.
    // Sistema não consegue validar a autorização — emite AVISO para conferência.
    const item = makeItem({ ncm: '22071000', pICMS: 12, cCredPresumido: 'CP123' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('AVISO');
  });

  it('NCM proibida + SC×PR (interestadual) → ERRO (V01, exceção não aplica fora de SC)', () => {
    const item = makeItem({ ncm: '22071000', pICMS: 12, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'PR' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });

  it('NCM proibida + SC×SC + 4% + sem CP → ERRO (V01, alíquota abaixo do patamar 10%)', () => {
    // Alíquota 4% + NCM vedado é inconsistente: se usa TTD (4%), o NCM não deveria ser vedado.
    const item = makeItem({ ncm: '22071000', pICMS: 4, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01');
    expect(results[0]!.status).toBe('ERRO');
  });

  it('NCM 70071900 (vidros temperados) + SC×SC + 12% + sem CP → AVISO V01-EXC (caso Prime)', () => {
    // Caso concreto da apuração Prime 03/2026: série 2 com vidros temperados
    const item = makeItem({ ncm: '70071900', pICMS: 12, cCredPresumido: '' });
    const nfe = makeNfe({ emitUF: 'SC', dest: makeDest({ uf: 'SC' }) });
    const results = verificarVedacoes(item, nfe, config);
    expect(results[0]!.regra).toBe('V01-EXC');
    expect(results[0]!.status).toBe('AVISO');
  });
});
