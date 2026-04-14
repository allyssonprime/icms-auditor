import { describe, it, expect } from 'vitest';
import { validarInfoComplementares } from '../infCplValidation.ts';
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

describe('validarInfoComplementares', () => {
  describe('IC01 — diferimento parcial', () => {
    it('emite AVISO quando cenário exige diferimento parcial e infCpl está vazio', () => {
      const results = validarInfoComplementares('', makeCenario());
      const ic01 = results.find(r => r.regra === 'IC01');
      expect(ic01).toBeDefined();
      expect(ic01?.status).toBe('AVISO');
    });

    it('aceita menção a "diferimento parcial" (case-insensitive)', () => {
      const results = validarInfoComplementares(
        'ICMS com DIFERIMENTO PARCIAL conforme TTD 410',
        makeCenario(),
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('aceita variação "ICMS diferido"', () => {
      const results = validarInfoComplementares(
        'Operação com ICMS diferido parcialmente',
        makeCenario(),
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('aceita texto com acentos', () => {
      const results = validarInfoComplementares(
        'Diferimento parcial aplicável',
        makeCenario(),
      );
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });

    it('não emite quando cenário não exige diferimento parcial', () => {
      const cenario = makeCenario({ temDiferimentoParcial: false });
      const results = validarInfoComplementares('', cenario);
      expect(results.some(r => r.regra === 'IC01')).toBe(false);
    });
  });

  describe('caso limpo', () => {
    it('não emite nada quando cenário não exige nada e infCpl está vazio', () => {
      const cenario = makeCenario({ id: 'A1', temDiferimentoParcial: false });
      const results = validarInfoComplementares('', cenario);
      expect(results).toHaveLength(0);
    });

    it('emite IC01 para cenário com diferimento parcial e infCpl vazio', () => {
      const cenario = makeCenario({ temDiferimentoParcial: true });
      const results = validarInfoComplementares('', cenario);
      expect(results.map(r => r.regra)).toEqual(['IC01']);
    });
  });
});
