import { describe, it, expect } from 'vitest';
import { validarAliquota, isNaoContribuinte } from '../aliquota.ts';
import { CENARIOS } from '../cenarios.ts';
import { makeItem, makeDest, makeConfig } from './fixtures.ts';

describe('validarAliquota', () => {
  const config = makeConfig();

  it('should return OK for correct rate (A1: 4%)', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('should return ERRO for wrong rate (A1: expects 4%, got 12%)', () => {
    const item = makeItem({ pICMS: 12 });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('ERRO');
  });

  it('should resolve CAMEX rate by UF (A2: 12% for SP)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6' });
    const dest = makeDest({ uf: 'SP' });
    const { result } = validarAliquota(item, CENARIOS['A2']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('should resolve CAMEX rate by UF (A2: 7% for BA)', () => {
    const item = makeItem({ pICMS: 7 });
    const dest = makeDest({ uf: 'BA' });
    const { result } = validarAliquota(item, CENARIOS['A2']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('should reject wrong CAMEX rate (A2: 4% for SP)', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'SP' });
    const { result } = validarAliquota(item, CENARIOS['A2']!, dest, config);
    expect(result.status).toBe('ERRO');
  });

  it('should accept valid internal rates for B5 (SN dest), 17% with SN-only → ALERTA', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    for (const rate of [7, 8.8, 12, 25]) {
      const item = makeItem({ pICMS: rate });
      const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
      const { result } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
      expect(result.status).toBe('OK');
    }
    // 17% com SN como unica justificativa → ALERTA (justificativa fraca)
    const item17 = makeItem({ pICMS: 17 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result: result17 } = validarAliquota(item17, CENARIOS['B5']!, dest, snConfig);
    expect(result17.status).toBe('ALERTA');
    expect(result17.regra).toBe('AL07');
  });

  it('should handle float tolerance (4.001 ~ 4)', () => {
    const item = makeItem({ pICMS: 4.001 });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('B3: should alert when 4% used instead of 10%', () => {
    const item = makeItem({ pICMS: 4 });
    const dest = makeDest({ uf: 'SC' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(result.mensagem).toContain('10%');
  });

  it('B3: should accept 10% when dest is industrial', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const industrialConfig = makeConfig({ listaIndustriais: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, industrialConfig);
    expect(result.status).toBe('OK');
  });

  it('B3: should alert 10% when dest is not industrial', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(result.mensagem).toContain('divergencias');
  });
});

describe('cross-checks 12% (OR logic with severity)', () => {
  const config = makeConfig();

  it('12% + CST orig 6 → OK, CK12A=ok, CK12B=atencao (OR passed via CST6)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('atencao');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.severity).toBe('ok');
  });

  it('12% + NCM na Camex → OK, CK12B=ok', () => {
    const camexConfig = makeConfig({ listaCamex: ['8471'] });
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '190' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, camexConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('atencao');
  });

  it('12% + CST 6 + NCM Camex → OK, both ok', () => {
    const camexConfig = makeConfig({ listaCamex: ['8471'] });
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, camexConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('ok');
  });

  it('12% + SN dest → OK, CK12C=ok', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12C')?.severity).toBe('ok');
  });

  it('12% + NC dest (no CAMEX, no SN) → ALERTA, CK12D=divergente', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.severity).toBe('divergente');
  });

  it('12% + no justification (no CAMEX, no SN, not NC) → ALERTA, all OR=divergente', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK12C')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.severity).toBe('ok');
  });
});

describe('cross-checks 4%', () => {
  const config = makeConfig();

  it('4% + CST orig 1 → checks ok (all mandatory)', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '151' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { crossChecks } = validarAliquota(item, CENARIOS['B1']!, dest, config);
    expect(crossChecks.find(c => c.regra === 'CK04C')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK04B')?.severity).toBe('ok');
  });

  it('4% + CST orig 6 → CK04B divergente', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '6', cst: '651' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B1']!, dest, config);
    expect(crossChecks.find(c => c.regra === 'CK04B')?.severity).toBe('divergente');
    expect(result.status).toBe('ALERTA');
  });

  it('4% + SN dest (B5) → CK04A divergente', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    // B5 does not accept 4% → ERRO, but cross-checks still run
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
    expect(result.status).toBe('ERRO');
    expect(crossChecks.find(c => c.regra === 'CK04A')?.severity).toBe('divergente');
  });

  it('4% + SN dest (B4 exception) → CK04A ok', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '110' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B4']!, dest, snConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK04A')?.severity).toBe('ok');
  });
});

describe('cross-checks 10% (OR: industrial OU CNAE)', () => {
  it('10% + B3 + industrial in list → OK, CK10B=ok', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const config = makeConfig({ listaIndustriais: ['12345678000199'] });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK10B')?.severity).toBe('ok');
  });

  it('10% + B3 + CNAE industrial (from cnpjInfoMap) → OK, CK10E=ok', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const config = makeConfig();
    const cnpjInfoMap = new Map([['12345678000199', {
      cnpj: '12345678000199',
      razaoSocial: 'Ind Teste',
      simplesOptante: false,
      cnaePrincipal: '10.01-1',
      cnaeDescricao: 'Fabricacao de produtos',
      cnaesSecundarios: [],
      isIndustrial: true,
    }]]);
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B3']!, dest, config, cnpjInfoMap);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK10E')?.severity).toBe('ok');
  });

  it('10% + B3 + not industrial → ALERTA, both OR=divergente', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC' });
    const config = makeConfig();
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(crossChecks.find(c => c.regra === 'CK10B')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK10E')?.severity).toBe('divergente');
  });
});

describe('cross-checks 17% (OR: BC reduzida OU SN OU NC)', () => {
  it('17% + BC reduzida (pRedBC) → OK', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '120', pRedBC: 48, vBC: 520, vProd: 1000 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK17A')?.severity).toBe('ok');
  });

  it('17% + SN only → ALERTA (weak justification)', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(result.regra).toBe('AL07');
    expect(crossChecks.find(c => c.regra === 'CK17B')?.severity).toBe('atencao');
  });

  it('17% + NC → OK', () => {
    const config = makeConfig();
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK17C')?.severity).toBe('ok');
  });

  it('17% + BC reduzida + SN → OK (strong justification present)', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '120', pRedBC: 48, vBC: 520, vProd: 1000 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('17% + BC cheia + contribuinte normal → ALERTA (no justification)', () => {
    const config = makeConfig();
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('ALERTA');
    expect(crossChecks.find(c => c.regra === 'CK17A')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK17B')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK17C')?.severity).toBe('divergente');
  });
});

describe('isNaoContribuinte', () => {
  it('indIEDest=9 → NC', () => {
    expect(isNaoContribuinte(makeDest({ indIEDest: '9', ie: '123' }))).toBe(true);
  });

  it('IE vazia → NC', () => {
    expect(isNaoContribuinte(makeDest({ indIEDest: '1', ie: '' }))).toBe(true);
  });

  it('IE undefined → NC', () => {
    expect(isNaoContribuinte(makeDest({ indIEDest: '1', ie: undefined }))).toBe(true);
  });

  it('IE ISENTA → NC', () => {
    expect(isNaoContribuinte(makeDest({ indIEDest: '2', ie: 'ISENTA' }))).toBe(true);
  });

  it('IE ISENTO → NC', () => {
    expect(isNaoContribuinte(makeDest({ indIEDest: '2', ie: 'ISENTO' }))).toBe(true);
  });

  it('IE com numero + indIEDest=1 → NOT NC', () => {
    expect(isNaoContribuinte(makeDest({ indIEDest: '1', ie: '1234567890' }))).toBe(false);
  });
});

describe('cross-checks passed field', () => {
  it('12% + CST 6 → CK12A.passed=true, CK12B.passed=false', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, makeConfig());
    expect(crossChecks.find(c => c.regra === 'CK12A')?.passed).toBe(true);
    expect(crossChecks.find(c => c.regra === 'CK12B')?.passed).toBe(false);
  });

  it('4% + CST orig 1 → CK04C.passed=true, CK04B.passed=true', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '151' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { crossChecks } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(crossChecks.find(c => c.regra === 'CK04C')?.passed).toBe(true);
    expect(crossChecks.find(c => c.regra === 'CK04B')?.passed).toBe(true);
  });

  it('17% + NC → CK17C.passed=true', () => {
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, makeConfig());
    expect(crossChecks.find(c => c.regra === 'CK17C')?.passed).toBe(true);
  });

  it('NC by empty IE → 12% CK12D divergente', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1', ie: '' });
    const { crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, makeConfig());
    expect(crossChecks.find(c => c.regra === 'CK12D')?.severity).toBe('divergente');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.passed).toBe(false);
  });
});
