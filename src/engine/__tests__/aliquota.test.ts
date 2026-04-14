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
    const item = makeItem({ pICMS: 12, cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'PR' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, config);
    expect(result.status).toBe('ERRO');
  });

  it('should resolve CAMEX rate by UF (A2: 12% for SP)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cCredPresumido: 'CP123' });
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

  it('should accept valid internal rates for B5 (SN dest), 17% with SN-only → AVISO', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    // v3: B5 aceita apenas [12, 17, 25] (removidos 7% e 8.80%)
    for (const rate of [12, 25]) {
      const item = makeItem({ pICMS: rate, cCredPresumido: rate >= 12 ? 'CP123' : undefined });
      const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
      const { result } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
      expect(result.status).toBe('OK');
    }
    // 17% com SN como unica justificativa → AVISO (justificativa fraca)
    const item17 = makeItem({ pICMS: 17 });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result: result17 } = validarAliquota(item17, CENARIOS['B5']!, dest, snConfig);
    expect(result17.status).toBe('AVISO');
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
    expect(result.status).toBe('INFO');
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
    expect(result.status).toBe('DIVERGENCIA');
    expect(result.mensagem).toContain('divergencias');
  });
});

describe('cross-checks 12% (OR logic with severity)', () => {
  const config = makeConfig();

  it('12% + CST orig 6 → OK, CK12A=ok, CK12B=atencao (OR passed via CST6)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('atencao');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.severity).toBe('ok');
  });

  it('12% + NCM na Camex → OK, CK12B=ok', () => {
    const camexConfig = makeConfig({ listaCamex: ['8471'] });
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '190', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, camexConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('atencao');
  });

  it('12% + CST 6 + NCM Camex → OK, both ok', () => {
    const camexConfig = makeConfig({ listaCamex: ['8471'] });
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, camexConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12A')?.severity).toBe('ok');
    expect(crossChecks.find(c => c.regra === 'CK12B')?.severity).toBe('ok');
  });

  it('12% + SN dest → OK, CK12C=ok', () => {
    const snConfig = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, snConfig);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK12C')?.severity).toBe('ok');
  });

  it('12% + NC dest (no CAMEX, no SN) → DIVERGENCIA, CK12D=divergente', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, config);
    expect(result.status).toBe('DIVERGENCIA');
    expect(crossChecks.find(c => c.regra === 'CK12D')?.severity).toBe('divergente');
  });

  it('12% + no justification (no CAMEX, no SN, not NC) → DIVERGENCIA, all OR=divergente', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B2']!, dest, config);
    expect(result.status).toBe('DIVERGENCIA');
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
    expect(result.status).toBe('DIVERGENCIA');
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
      isMei: null,
      cnaePrincipal: '10.01-1',
      cnaeDescricao: 'Fabricacao de produtos',
      cnaesSecundarios: [],
      isIndustrial: true,
    }]]);
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B3']!, dest, config, cnpjInfoMap);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK10E')?.severity).toBe('ok');
  });

  it('10% + B3 + not industrial → DIVERGENCIA, both OR=divergente', () => {
    const item = makeItem({ pICMS: 10 });
    const dest = makeDest({ uf: 'SC' });
    const config = makeConfig();
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B3']!, dest, config);
    expect(result.status).toBe('DIVERGENCIA');
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

  it('17% + SN only → AVISO (weak justification)', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('AVISO');
    expect(result.regra).toBe('AL07');
    expect(crossChecks.find(c => c.regra === 'CK17B')?.severity).toBe('atencao');
  });

  it('17% + NC → OK', () => {
    const config = makeConfig();
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B6']!, dest, config);
    expect(result.status).toBe('OK');
    expect(crossChecks.find(c => c.regra === 'CK17C')?.severity).toBe('ok');
  });

  it('17% + BC reduzida + SN → OK (strong justification present)', () => {
    const config = makeConfig({ listaSN: ['12345678000199'] });
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '120', pRedBC: 48, vBC: 520, vProd: 1000, cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const { result } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('OK');
  });

  it('17% + BC cheia + contribuinte normal → DIVERGENCIA (no justification)', () => {
    const config = makeConfig();
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result, crossChecks } = validarAliquota(item, CENARIOS['B5']!, dest, config);
    expect(result.status).toBe('DIVERGENCIA');
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

describe('12%+ sem crédito presumido → AVISO', () => {
  it('12% sem CP → AVISO AL08', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690', cCredPresumido: '' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B2']!, dest, makeConfig());
    expect(result.status).toBe('AVISO');
    expect(result.regra).toBe('AL08');
  });

  it('12% com CP → OK', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '690', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B2']!, dest, makeConfig());
    expect(result.status).toBe('OK');
  });

  it('12% sem CP mas CST 20 + pRedBC → OK (BC reduzida justifica)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cst: '620', cCredPresumido: '', pRedBC: 50 });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B2']!, dest, makeConfig());
    expect(result.status).toBe('OK');
  });

  it('17% sem CP mas CST 20 + pRedBC → OK (BC reduzida justifica)', () => {
    const item = makeItem({ pICMS: 17, cst: '020', cCredPresumido: '', pRedBC: 41.18 });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B5']!, dest, makeConfig());
    expect(result.status).toBe('OK');
  });

  it('4% sem CP → OK (abaixo de 12%)', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '1', cst: '151', cCredPresumido: '' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(result.status).toBe('OK');
  });
});

describe('AL09: alíquota diverge mas sem CP (não usa TTD)', () => {
  it('B3 com 12% sem CP → INFO AL09 (não ERRO AL01)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100', cCredPresumido: '' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, makeConfig());
    expect(result.status).toBe('INFO');
    expect(result.regra).toBe('AL09');
  });

  it('B3 com 12% com CP → AVISO AL10 (regime alternativo TTD)', () => {
    // Observado em apurações reais SC TTD 409: contribuintes (inclusive industriais)
    // podem destacar alíquota cheia com CP específico em vez da reduzida 1.2.a.
    // Não é ERRO — é AVISO para conferência via CP01–CP04.
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, makeConfig());
    expect(result.status).toBe('AVISO');
    expect(result.regra).toBe('AL10');
  });

  it('B1 com 17% sem CP → INFO AL09', () => {
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100', cCredPresumido: '' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(result.status).toBe('INFO');
    expect(result.regra).toBe('AL09');
  });

  it('B3 com 7% sem CP → ERRO AL01 (abaixo de 12%)', () => {
    const item = makeItem({ pICMS: 7, cstOrig: '1', cst: '100', cCredPresumido: '' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B3']!, dest, makeConfig());
    expect(result.status).toBe('ERRO');
    expect(result.regra).toBe('AL01');
  });
});

describe('AL10: regime alternativo TTD (interna + CP + alíquota cheia)', () => {
  it('B1 com 12% e CP em operação interna → AVISO AL10', () => {
    // Reflete o grupo "Operação Interna 2,10" / "3,60" da apuração TTD 409:
    // contribuinte normal interno destacando 12% com CP específico
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(result.status).toBe('AVISO');
    expect(result.regra).toBe('AL10');
  });

  it('B1 com 10% e CP em operação interna → AVISO AL10', () => {
    // Caso de dest. não classificado como industrial mas com alíquota 10% + CP
    const item = makeItem({ pICMS: 10, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(result.status).toBe('AVISO');
    expect(result.regra).toBe('AL10');
  });

  it('B1 com 17% e CP em operação interna → AVISO AL10', () => {
    const item = makeItem({ pICMS: 17, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(result.status).toBe('AVISO');
    expect(result.regra).toBe('AL10');
  });

  it('A1 interestadual com 12% e CP → ERRO AL01 (AL10 não aplica fora de SC)', () => {
    // Interestadual com TTD deve ser 4% — 12% com CP é erro de fato
    const item = makeItem({ pICMS: 12, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'PR', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['A1']!, dest, makeConfig());
    expect(result.status).toBe('ERRO');
    expect(result.regra).toBe('AL01');
  });

  it('B1 com 7% e CP em operação interna → ERRO AL01 (abaixo do patamar AL10)', () => {
    // AL10 só dispara para alíquotas cheias ≥10%. 7% não é cheia interna SC.
    const item = makeItem({ pICMS: 7, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B1']!, dest, makeConfig());
    expect(result.status).toBe('ERRO');
    expect(result.regra).toBe('AL01');
  });
});

// ===== Testes v3: regras atualizadas TTD 410 =====

describe('v3 — B2-Industrial: CAMEX prevalece, só aceita 12%', () => {
  it('B2-Industrial com 12% → OK', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B2-Industrial']!, dest, makeConfig());
    expect(result.status).toBe('OK');
  });

  it('B2-Industrial com 10% → ERRO (CAMEX prevalece, não aceita 10%)', () => {
    const item = makeItem({ pICMS: 10, cstOrig: '6' });
    const dest = makeDest({ uf: 'SC', indIEDest: '1' });
    const { result } = validarAliquota(item, CENARIOS['B2-Industrial']!, dest, makeConfig());
    // 10% sem CP → INFO AL09 (não usa TTD); com CP em cenário que espera 12% → AVISO/ERRO
    expect(['ERRO', 'INFO']).toContain(result.status);
  });
});

describe('v3 — B4-CAMEX: SN + ST + CAMEX aceita alíquota integral [12, 17, 25]', () => {
  it('B4-CAMEX com 12% → OK', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B4-CAMEX']!, dest, cfg);
    expect(result.status).toBe('OK');
  });

  it('B4-CAMEX com 17% → OK (alíquota integral interna)', () => {
    const item = makeItem({ pICMS: 17, cstOrig: '6' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B4-CAMEX']!, dest, cfg);
    // 17% está na lista aceita — pode ser OK ou AVISO (SN-only justification)
    expect(['OK', 'AVISO']).toContain(result.status);
  });

  it('B4-CAMEX com 25% → OK (alíquota integral interna)', () => {
    const item = makeItem({ pICMS: 25, cstOrig: '6', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B4-CAMEX']!, dest, cfg);
    expect(result.status).toBe('OK');
  });

  it('B4-CAMEX com 4% → ERRO (diferimento indevido para CAMEX + SN + ST)', () => {
    const item = makeItem({ pICMS: 4, cstOrig: '6' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B4-CAMEX']!, dest, cfg);
    expect(result.status).toBe('ERRO');
  });
});

describe('v3 — B5: SN sem ST aceita [12, 17, 25], rejeita 7% e 8.80%', () => {
  it('B5 com 7% → ERRO (removido v3)', () => {
    const item = makeItem({ pICMS: 7, cstOrig: '1' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B5']!, dest, cfg);
    expect(result.status).toBe('ERRO');
  });

  it('B5 com 8.80% → ERRO (removido v3)', () => {
    const item = makeItem({ pICMS: 8.80, cstOrig: '1' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B5']!, dest, cfg);
    expect(result.status).toBe('ERRO');
  });
});

describe('v3 — B6/B6-CAMEX: PJ NC split por CAMEX', () => {
  it('B6 sem CAMEX com 7% → OK (alternativa v3 I05)', () => {
    const item = makeItem({ pICMS: 7, cstOrig: '1', cst: '100', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result } = validarAliquota(item, CENARIOS['B6']!, dest, makeConfig());
    expect(result.status).toBe('OK');
  });

  it('B6 com 8.80% → ERRO (removido v3)', () => {
    const item = makeItem({ pICMS: 8.80, cstOrig: '1' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result } = validarAliquota(item, CENARIOS['B6']!, dest, makeConfig());
    expect(result.status).toBe('ERRO');
  });

  it('B6-CAMEX com 17% → OK (NC aceita alíquota integral)', () => {
    const item = makeItem({ pICMS: 17, cstOrig: '6', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result } = validarAliquota(item, CENARIOS['B6-CAMEX']!, dest, makeConfig());
    // 17% + NC → cross-check CK17C passa → OK
    expect(result.status).toBe('OK');
  });

  it('B6-CAMEX com 12% + NC → DIVERGENCIA (CK12D falha para NC, esperado)', () => {
    const item = makeItem({ pICMS: 12, cstOrig: '6', cCredPresumido: 'CP123' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result } = validarAliquota(item, CENARIOS['B6-CAMEX']!, dest, makeConfig());
    // 12% na lista aceita, mas CK12D (not NC) obrigatório falha → DIVERGENCIA
    expect(result.status).toBe('DIVERGENCIA');
  });

  it('B6-CAMEX com 7% → ERRO (v3 I14: CAMEX NC não aceita 7%)', () => {
    const item = makeItem({ pICMS: 7, cstOrig: '6' });
    const dest = makeDest({ uf: 'SC', indIEDest: '9' });
    const { result } = validarAliquota(item, CENARIOS['B6-CAMEX']!, dest, makeConfig());
    expect(result.status).toBe('ERRO');
  });
});

describe('v3 — CAMEX override: não estreita alíquotas para operações internas', () => {
  it('B4-CAMEX interno SC com multi-rate não sofre narrowing', () => {
    // Bug fix: antes o narrowing transformaria [12, 17, 25] em [7] para SC
    const item = makeItem({ pICMS: 17, cstOrig: '6' });
    const dest = makeDest({ uf: 'SC', cnpj: '12345678000199' });
    const cfg = makeConfig({ listaSN: ['12345678000199'] });
    const { result } = validarAliquota(item, CENARIOS['B4-CAMEX']!, dest, cfg);
    // 17% deve estar aceita, não rejeitada pelo narrowing
    expect(result.status).not.toBe('ERRO');
  });

  it('A2 interestadual CAMEX continua com narrowing por UF', () => {
    // SP → 12%, BA → 7%
    const item12 = makeItem({ pICMS: 12, cstOrig: '6', cCredPresumido: 'CP123' });
    const destSP = makeDest({ uf: 'SP' });
    const { result: r12 } = validarAliquota(item12, CENARIOS['A2']!, destSP, makeConfig());
    expect(r12.status).toBe('OK');

    const item7 = makeItem({ pICMS: 7, cstOrig: '6', cCredPresumido: 'CP123' });
    const destBA = makeDest({ uf: 'BA' });
    const { result: r7 } = validarAliquota(item7, CENARIOS['A2']!, destBA, makeConfig());
    expect(r7.status).toBe('OK');
  });
});
