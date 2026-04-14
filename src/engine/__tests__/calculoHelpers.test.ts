import { describe, it, expect } from 'vitest';
import {
  deriveCargaEfetiva,
  calcularICMSRecolherItem,
  calcularFundosItem,
} from '../calculoHelpers.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem } from './fixtures.ts';

describe('deriveCargaEfetiva', () => {
  it('usa cargaEfetiva do cenario quando pICMS bate com aliquotasAceitas', () => {
    const b3 = CENARIOS['B3'];
    expect(b3).toBeDefined();
    // B3 aceita aliquotas >= 7% com cargaEfetiva = 3.6
    expect(deriveCargaEfetiva(10, b3, false)).toBe(3.6);
  });

  it('deriva 3.6 quando pICMS=10 cai em cenario que espera apenas 4% (ex.: B1)', () => {
    const b1 = CENARIOS['B1'];
    expect(b1).toBeDefined();
    // B1 aceita 4% com cargaEfetiva = 1.0, mas pICMS=10 eh divergente
    expect(b1.aliquotasAceitas).toContain(4);
    expect(b1.cargaEfetiva).toBe(1.0);
    expect(deriveCargaEfetiva(10, b1, false)).toBe(3.6);
  });

  it('retorna 0.6 para cobre/aco com pICMS=4 (exceção) quando bate com cenario', () => {
    const b1 = CENARIOS['B1'];
    expect(deriveCargaEfetiva(4, b1, true)).toBe(0.6);
  });

  it('retorna 1.0 para pICMS=4 sem cobre/aco quando bate com cenario', () => {
    const b1 = CENARIOS['B1'];
    expect(deriveCargaEfetiva(4, b1, false)).toBe(1.0);
  });

  it('preserva cargaEfetiva negativa (cenarios sem CP, B7/B12)', () => {
    const b7 = CENARIOS['B7'];
    if (b7 && b7.cargaEfetiva < 0) {
      expect(deriveCargaEfetiva(17, b7, false)).toBe(b7.cargaEfetiva);
    }
    // Simulacao defensiva caso B7 mude
    const fakeSemCP = { ...CENARIOS['B1'], cargaEfetiva: -1 };
    expect(deriveCargaEfetiva(17, fakeSemCP, false)).toBe(-1);
  });

  it('retorna 0 para pICMS=0 (diferimento total) quando diverge do cenario', () => {
    const b1 = CENARIOS['B1'];
    expect(deriveCargaEfetiva(0, b1, false)).toBe(0);
  });

  it('deriva 0.6 para pICMS=4 cobre/aco mesmo quando diverge do cenario', () => {
    // Cenario que NAO aceita 4%: forca derivacao
    const cenarioSem4 = { ...CENARIOS['B3'], aliquotasAceitas: [7, 12, 17, 25] };
    expect(deriveCargaEfetiva(4, cenarioSem4, true)).toBe(0.6);
    expect(deriveCargaEfetiva(4, cenarioSem4, false)).toBe(1.0);
  });

  it('usa cargaEfetiva do cenario quando pICMS=10 bate com aliquotasAceitas (ex.: B11 saida 10%)', () => {
    const b11 = CENARIOS['B11'];
    if (b11 && b11.aliquotasAceitas.includes(10)) {
      // B11 aceita 10% com cargaEfetiva propria
      expect(deriveCargaEfetiva(10, b11, false)).toBe(b11.cargaEfetiva);
    }
  });
});

describe('calcularICMSRecolherItem', () => {
  it('item sem pRedBC em B1 com pICMS=4 → bcIntegral × 1% (carga cenario)', () => {
    const b1 = CENARIOS['B1']!;
    const item = makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, pRedBC: 0 });
    // B1 aceita 4% com carga 1%; bcInt = 1000 → recolher = 10
    expect(calcularICMSRecolherItem(item, b1, false)).toBe(10);
  });

  it('item sem pRedBC em B1 com pICMS=17 → usa derivacao 3.6%', () => {
    const b1 = CENARIOS['B1']!;
    // pICMS=17 diverge de B1 (espera 4%) → deriveCargaEfetiva retorna 3.6
    const item = makeItem({ pICMS: 17, vBC: 1000, vICMS: 170, pRedBC: 0 });
    expect(calcularICMSRecolherItem(item, b1, false)).toBeCloseTo(36, 2);
  });

  it('item com pRedBC > 0 em B1 → recolher sobre BC integral × carga (NAO vICMS destacado)', () => {
    const b1 = CENARIOS['B1']!;
    // vProd=1000, pRedBC=76.47%, pICMS=17 → vBC~235.30, vICMS=40
    // pICMS=17 diverge de B1 (espera 4%) → carga derivada = 3.6
    // Recolher correto: bcIntegral (1000) × 3.6% = 36 (NAO vICMS=40)
    const item = makeItem({ pICMS: 17, vBC: 235.30, vICMS: 40, pRedBC: 76.47 });
    expect(calcularICMSRecolherItem(item, b1, false)).toBeCloseTo(36, 1);
  });

  it('item com pRedBC=50 em B3 → recolher sobre BC integral × carga cenario', () => {
    const b3 = CENARIOS['B3']!;
    // vProd=1000, vBC=500 (50% reduzida), pICMS=17, vICMS=85
    // B3 carga 3.6 — recolher correto: 1000 × 3.6% = 36 (regra fiscal:
    // a reducao de BC nao reduz a obrigacao de recolhimento)
    const item = makeItem({ pICMS: 17, vBC: 500, vICMS: 85, pRedBC: 50 });
    expect(calcularICMSRecolherItem(item, b3, false)).toBeCloseTo(36, 2);
  });

  it('cobre/aco sem pRedBC com pICMS=4 → carga 0.6%', () => {
    const b1 = CENARIOS['B1']!;
    const item = makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, pRedBC: 0 });
    expect(calcularICMSRecolherItem(item, b1, true)).toBe(6);
  });

  it('cenario sem carga (<0) sem pRedBC → recolher 0', () => {
    const fakeSemCP = { ...CENARIOS['B1']!, cargaEfetiva: -1 };
    const item = makeItem({ pICMS: 17, vBC: 1000, vICMS: 170, pRedBC: 0 });
    expect(calcularICMSRecolherItem(item, fakeSemCP, false)).toBe(0);
  });
});

describe('calcularFundosItem', () => {
  it('fundos sempre sobre bcIntegral (reverte pRedBC)', () => {
    // vProd=1000, pRedBC=50 → vBC=500, bcIntegral=1000
    const cenarioComFundos = { ...CENARIOS['B1']!, fundos: 0.4 };
    const item = makeItem({ vBC: 500, pRedBC: 50 });
    expect(calcularFundosItem(item, cenarioComFundos)).toBeCloseTo(4, 2);
  });

  it('fundos zero quando cenario nao exige', () => {
    const b1 = CENARIOS['B1']!;
    const item = makeItem({ vBC: 1000 });
    // B1 tem fundos 0 no default
    if (b1.fundos === 0) {
      expect(calcularFundosItem(item, b1)).toBe(0);
    }
  });
});
