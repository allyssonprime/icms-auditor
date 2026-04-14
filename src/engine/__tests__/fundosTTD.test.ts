import { describe, it, expect } from 'vitest';
import { calcularFundosTTD, TAXA_FUNDEC, TAXA_FUMDES, TAXA_FUNDO_SOCIAL } from '../fundosTTD.ts';

describe('calcularFundosTTD', () => {
  it('FUNDEC = 0,05% × BC', () => {
    const r = calcularFundosTTD(1_000_000, 0);
    expect(r.fundec).toBeCloseTo(500, 2);
    expect(TAXA_FUNDEC).toBe(0.05);
  });

  it('FUMDES = 2,00% × CP', () => {
    const r = calcularFundosTTD(0, 100_000);
    expect(r.fumdes).toBeCloseTo(2_000, 2);
    expect(TAXA_FUMDES).toBe(2);
  });

  it('Fundo Social = 0,4% × BC − FUMDES (positivo)', () => {
    // BC=1.000.000 → 0,4% = 4.000
    // CP=100.000 → FUMDES = 2.000
    // Fundo Social = 4.000 − 2.000 = 2.000
    const r = calcularFundosTTD(1_000_000, 100_000);
    expect(r.fundoSocial).toBeCloseTo(2_000, 2);
    expect(TAXA_FUNDO_SOCIAL).toBe(0.4);
  });

  it('Fundo Social cap em zero quando FUMDES > 0,4% BC', () => {
    // BC=100 → 0,4% = 0,40
    // CP=1.000.000 → FUMDES = 20.000
    // Fundo Social = max(0, 0,40 − 20.000) = 0
    const r = calcularFundosTTD(100, 1_000_000);
    expect(r.fundoSocial).toBe(0);
  });

  it('Pro-Emprego retorna 0 no MVP (TTD 410)', () => {
    const r = calcularFundosTTD(82_528_781.67, 5_072_233.13);
    expect(r.proEmprego).toBe(0);
  });

  it('Validacao contra PDF real (Marco/2026, PRIME INTERNACIONAL)', () => {
    // Numeros do "Relatorio da Apuracao dos Creditos por Regime Especial"
    // - Total BC integral (saidas com beneficio TTD 410): 82.528.781,67
    // - Total credito presumido: 5.072.233,13
    // - FUMDES esperado: 101.444,66
    // - Fundo Social esperado: 228.670,47
    const totalBC = 82_528_781.67;
    const totalCP = 5_072_233.13;
    const r = calcularFundosTTD(totalBC, totalCP);
    // Tolerancia: 1 centavo (PDF arredonda valores intermediarios)
    expect(r.fumdes).toBeCloseTo(101_444.66, 1);
    expect(r.fundoSocial).toBeCloseTo(228_670.47, 1);
    // FUNDEC: 0,05% × 82.528.781,67 = 41.264,39
    expect(r.fundec).toBeCloseTo(41_264.39, 1);
  });

  it('totais zerados retornam tudo zero', () => {
    const r = calcularFundosTTD(0, 0);
    expect(r.fundec).toBe(0);
    expect(r.fumdes).toBe(0);
    expect(r.proEmprego).toBe(0);
    expect(r.fundoSocial).toBe(0);
  });
});
