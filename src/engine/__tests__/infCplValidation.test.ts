import { describe, it, expect } from 'vitest';
import { validarInfoComplementares } from '../infCplValidation.ts';
import { makeItem } from './fixtures.ts';
import type { CenarioConfig } from '../../types/cenario.ts';

function makeCenario(overrides: Partial<CenarioConfig> = {}): CenarioConfig {
  return {
    id: 'B1',
    nome: 'Interna contribuinte (teste)',
    aliquotasAceitas: [4],
    cargaEfetiva: 1.0,
    fundos: 0.4,
    cstEsperado: ['51'],
    cfopsEsperados: ['5101'],
    temCP: true,
    temDiferimentoParcial: true,
    refTTD: '1.2.a',
    ...overrides,
  };
}

const itemSemCP = makeItem({ cCredPresumido: '' });
const itemComCP = makeItem({ cCredPresumido: 'SC850065' });

describe('validarInfoComplementares', () => {
  describe('IC01 — diferimento parcial', () => {
    it('emite AVISO quando cenário exige diferimento parcial, item sem CP e infCpl vazio', () => {
      const results = validarInfoComplementares('', makeCenario(), itemSemCP);
      const ic01 = results.find(r => r.regra === 'IC01');
      expect(ic01).toBeDefined();
      expect(ic01?.status).toBe('AVISO');
    });

    it('aceita menção a "diferimento parcial" (case-insensitive)', () => {
      const results = validarInfoComplementares(
        'ICMS com DIFERIMENTO PARCIAL conforme TTD 410',
        makeCenario(),
        itemSemCP,
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('aceita variação "ICMS diferido"', () => {
      const results = validarInfoComplementares(
        'Operação com ICMS diferido parcialmente',
        makeCenario(),
        itemSemCP,
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('aceita texto com acentos', () => {
      const results = validarInfoComplementares(
        'Diferimento parcial aplicável',
        makeCenario(),
        itemSemCP,
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('não emite quando cenário não exige diferimento parcial', () => {
      const cenario = makeCenario({ temDiferimentoParcial: false });
      const results = validarInfoComplementares('', cenario, itemSemCP);
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('NÃO emite quando item declara cCredPresumido (CP é sinal forte)', () => {
      // Mesmo com infCpl vazio, se o item tem CP declarado, IC01 não dispara
      const results = validarInfoComplementares('', makeCenario(), itemComCP);
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('NÃO emite quando infCpl referencia "TTD 1250..." (formato Prime)', () => {
      const results = validarInfoComplementares(
        'TTD 125000001544551|D.I. N. 26BR00001894812',
        makeCenario(),
        itemSemCP,
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('NÃO emite quando infCpl referencia "TTD 410"', () => {
      const results = validarInfoComplementares(
        'Operação sob regime TTD 410',
        makeCenario(),
        itemSemCP,
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('emite AVISO quando item sem CP e infCpl sem menção TTD/diferimento', () => {
      const results = validarInfoComplementares(
        'Operação normal sem referência ao regime',
        makeCenario(),
        itemSemCP,
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(true);
    });
  });

  describe('caso limpo', () => {
    it('não emite nada quando cenário não exige nada e infCpl está vazio', () => {
      const cenario = makeCenario({ id: 'A1', temDiferimentoParcial: false });
      const results = validarInfoComplementares('', cenario, itemSemCP);
      expect(results).toHaveLength(0);
    });

    it('emite IC01 para cenário com diferimento parcial, item sem CP e infCpl vazio', () => {
      const cenario = makeCenario({ temDiferimentoParcial: true });
      const results = validarInfoComplementares('', cenario, itemSemCP);
      expect(results.map(r => r.regra)).toEqual(['IC01']);
    });
  });
});
