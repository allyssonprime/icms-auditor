import { describe, it, expect } from 'vitest';
import { parseEfd, splitEfdLine, parseEfdNumber, parseEfdDate } from '../efdParser';

/** Build a pipe-delimited EFD line: |REG|f1|f2|...| */
function makeEfdLine(reg: string, fields: string[]): string {
  return `|${reg}|${fields.join('|')}|`;
}

/** Encode lines as Latin-1 ArrayBuffer */
function makeEfdBuffer(lines: string[]): ArrayBuffer {
  const text = lines.join('\r\n');
  // For ASCII-range chars, UTF-8 === Latin-1
  const encoder = new TextEncoder();
  return encoder.encode(text).buffer;
}

// Minimal 0000 register fields (positions 1-14)
function make0000(overrides: Partial<{ ver: string; codFin: string; dtIni: string; dtFin: string; nome: string; cnpj: string; cpf: string; uf: string; ie: string }> = {}): string {
  const { ver = '017', codFin = '0', dtIni = '01032026', dtFin = '31032026', nome = 'EMPRESA TESTE LTDA', cnpj = '08214494000119', cpf = '', uf = 'SC', ie = '123456789' } = overrides;
  return makeEfdLine('0000', [ver, codFin, dtIni, dtFin, nome, cnpj, cpf, uf, ie, '4209102', '', '', 'A', '0']);
}

// C100 register fields (positions 1-28)
function makeC100(overrides: Partial<{
  indOper: string; indEmit: string; codPart: string; codMod: string; codSit: string;
  ser: string; numDoc: string; chvNfe: string; dtDoc: string; dtES: string;
  vlDoc: string; indPgto: string; vlDesc: string; vlAbatNt: string; vlMerc: string;
  indFrt: string; vlFrt: string; vlSeg: string; vlOutDa: string;
  vlBcIcms: string; vlIcms: string; vlBcIcmsSt: string; vlIcmsSt: string;
  vlIpi: string; vlPis: string; vlCofins: string; vlPisSt: string; vlCofinsSt: string;
}> = {}): string {
  const {
    indOper = '1', indEmit = '0', codPart = 'PART001', codMod = '55', codSit = '00',
    ser = '001', numDoc = '47611', chvNfe = '42260308214494000119550010000476111014848505',
    dtDoc = '02032026', dtES = '02032026', vlDoc = '0156795,43', indPgto = '0',
    vlDesc = '0', vlAbatNt = '0', vlMerc = '0156795,43', indFrt = '0',
    vlFrt = '0', vlSeg = '0', vlOutDa = '0',
    vlBcIcms = '0151859,98', vlIcms = '015186,00',
    vlBcIcmsSt = '0', vlIcmsSt = '0', vlIpi = '0', vlPis = '0',
    vlCofins = '0', vlPisSt = '0', vlCofinsSt = '0',
  } = overrides;
  return makeEfdLine('C100', [
    indOper, indEmit, codPart, codMod, codSit,
    ser, numDoc, chvNfe, dtDoc, dtES,
    vlDoc, indPgto, vlDesc, vlAbatNt, vlMerc,
    indFrt, vlFrt, vlSeg, vlOutDa,
    vlBcIcms, vlIcms, vlBcIcmsSt, vlIcmsSt,
    vlIpi, vlPis, vlCofins, vlPisSt, vlCofinsSt,
  ]);
}

describe('splitEfdLine', () => {
  it('splits a standard pipe-delimited line', () => {
    expect(splitEfdLine('|C100|1|0|PART|')).toEqual(['C100', '1', '0', 'PART']);
  });

  it('returns empty array for non-pipe line', () => {
    expect(splitEfdLine('not a pipe line')).toEqual([]);
  });

  it('handles empty fields', () => {
    expect(splitEfdLine('|C100||0||')).toEqual(['C100', '', '0', '']);
  });
});

describe('parseEfdNumber', () => {
  it('parses Brazilian format number', () => {
    expect(parseEfdNumber('0156795,43')).toBeCloseTo(156795.43);
  });

  it('parses integer', () => {
    expect(parseEfdNumber('1000')).toBe(1000);
  });

  it('returns 0 for empty string', () => {
    expect(parseEfdNumber('')).toBe(0);
  });

  it('returns 0 for whitespace', () => {
    expect(parseEfdNumber('  ')).toBe(0);
  });

  it('parses small number with leading zeros', () => {
    expect(parseEfdNumber('004,00')).toBeCloseTo(4.0);
  });
});

describe('parseEfdDate', () => {
  it('parses DDMMYYYY to DD/MM/YYYY', () => {
    expect(parseEfdDate('02032026')).toBe('02/03/2026');
  });

  it('returns empty for short input', () => {
    expect(parseEfdDate('0203')).toBe('');
  });

  it('returns empty for empty input', () => {
    expect(parseEfdDate('')).toBe('');
  });
});

describe('parseEfd', () => {
  it('parses 0000 register for company info and competência', () => {
    const buffer = makeEfdBuffer([make0000()]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.company.cnpj).toBe('08214494000119');
    expect(result.data.company.nome).toBe('EMPRESA TESTE LTDA');
    expect(result.data.company.uf).toBe('SC');
    expect(result.data.company.competencia).toBe('03/2026');
    expect(result.data.company.dtIni).toBe('01/03/2026');
    expect(result.data.company.dtFin).toBe('31/03/2026');
  });

  it('returns error when 0000 register is missing', () => {
    const buffer = makeEfdBuffer([makeC100()]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('0000');
  });

  it('parses C100 register with Brazilian number values', () => {
    const buffer = makeEfdBuffer([make0000(), makeC100()]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.c100s).toHaveLength(1);
    const c = result.data.c100s[0]!;
    expect(c.indOper).toBe('1');
    expect(c.indEmit).toBe('0');
    expect(c.codSit).toBe('00');
    expect(c.numDoc).toBe('47611');
    expect(c.serie).toBe('001');
    expect(c.chvNfe).toBe('42260308214494000119550010000476111014848505');
    expect(c.dtDoc).toBe('02/03/2026');
    expect(c.vlDoc).toBeCloseTo(156795.43);
    expect(c.vlBcIcms).toBeCloseTo(151859.98);
    expect(c.vlIcms).toBeCloseTo(15186.0);
    expect(c.isCancelado).toBe(false);
  });

  it('parses canceled C100 (COD_SIT=02) with empty values', () => {
    const buffer = makeEfdBuffer([
      make0000(),
      makeC100({
        codSit: '02', numDoc: '47640', vlDoc: '', vlBcIcms: '', vlIcms: '',
        vlMerc: '', vlDesc: '', vlFrt: '', vlSeg: '', vlOutDa: '',
        vlBcIcmsSt: '', vlIcmsSt: '', vlIpi: '', vlPis: '', vlCofins: '',
      }),
    ]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const c = result.data.c100s[0]!;
    expect(c.isCancelado).toBe(true);
    expect(c.vlDoc).toBe(0);
    expect(c.vlBcIcms).toBe(0);
    expect(c.vlIcms).toBe(0);
  });

  it('parses C110 and detects TTD', () => {
    const c110WithTtd = makeEfdLine('C110', ['COD001', 'DIFERIMENTO PARCIAL DO IMPOSTO TTD 125000001544551']);
    const c110WithoutTtd = makeEfdLine('C110', ['COD002', 'Informacao complementar sem beneficio']);

    const buffer = makeEfdBuffer([
      make0000(),
      makeC100({ numDoc: '47611' }),
      c110WithTtd,
      makeC100({ numDoc: '47612', chvNfe: '42260308214494000119550010000476121014848506' }),
      c110WithoutTtd,
    ]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.c100s).toHaveLength(2);
    expect(result.data.c100s[0]!.hasTtd).toBe(true);
    expect(result.data.c100s[0]!.c110Texts).toHaveLength(1);
    expect(result.data.c100s[0]!.c110Texts[0]).toContain('TTD');

    expect(result.data.c100s[1]!.hasTtd).toBe(false);
    expect(result.data.c100s[1]!.c110Texts).toHaveLength(1);
  });

  it('parses C113 and marks estorno/estornada', () => {
    // NF 47685 is the original, NF 99001 is the estorno referencing 47685
    const c113 = makeEfdLine('C113', ['0', '0', 'PART001', '55', '001', '', '47685', '05032026', '42260308214494000119550010000476851014848510']);

    const buffer = makeEfdBuffer([
      make0000(),
      makeC100({ numDoc: '47685', chvNfe: '42260308214494000119550010000476851014848510' }),
      makeC100({ numDoc: '99001', indOper: '0', chvNfe: '42260308214494000119550010000990011014848511' }),
      c113,
    ]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const estorno = result.data.c100s[1]!;
    expect(estorno.isEstorno).toBe(true);
    expect(estorno.nfReferenciada).toBe('47685');
    expect(estorno.c113Refs).toHaveLength(1);

    const estornada = result.data.c100s[0]!;
    expect(estornada.isEstornada).toBe(true);
    expect(estornada.estornadaPor).toBe('99001');
  });

  it('parses C190 consolidation records', () => {
    const c190 = makeEfdLine('C190', ['100', '5949', '010,00', '0156795,43', '0151859,98', '015186,00', '0', '0']);

    const buffer = makeEfdBuffer([
      make0000(),
      makeC100(),
      c190,
    ]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const c = result.data.c100s[0]!;
    expect(c.c190Items).toHaveLength(1);
    const item = c.c190Items[0]!;
    expect(item.cst).toBe('100');
    expect(item.cfop).toBe('5949');
    expect(item.aliqIcms).toBeCloseTo(10.0);
    expect(item.vlOpr).toBeCloseTo(156795.43);
    expect(item.vlBcIcms).toBeCloseTo(151859.98);
    expect(item.vlIcms).toBeCloseTo(15186.0);
  });

  it('parses E110 apuração totals', () => {
    // E110 fields: VL_TOT_DEBITOS|VL_AJ_DEBITOS|VL_TOT_AJ_DEBITOS|VL_ESTORNOS_CRED|VL_TOT_CREDITOS|...
    const e110 = makeEfdLine('E110', [
      '07814107,87', '0', '0', '0', '05000000,00',
      '0', '0', '0', '0', '02814107,87',
      '0', '02814107,87', '0', '0',
    ]);

    const buffer = makeEfdBuffer([make0000(), e110]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.e110).not.toBeNull();
    expect(result.data.e110!.vlTotDebitos).toBeCloseTo(7814107.87);
    expect(result.data.e110!.vlTotCreditos).toBeCloseTo(5000000.0);
    expect(result.data.e110!.vlSldApurado).toBeCloseTo(2814107.87);
    expect(result.data.e110!.vlIcmsRecolher).toBeCloseTo(2814107.87);
  });

  it('computes correct stats', () => {
    const buffer = makeEfdBuffer([
      make0000(),
      makeC100({ numDoc: '1', indOper: '1' }),
      makeC100({ numDoc: '2', indOper: '1' }),
      makeC100({ numDoc: '3', indOper: '0' }),
      makeC100({ numDoc: '4', indOper: '1', codSit: '02', vlDoc: '', vlBcIcms: '', vlIcms: '' }),
      makeEfdLine('C110', ['COD', 'TTD teste']),
    ]);
    // C110 above is child of numDoc=4 (last C100)
    // But numDoc=4 is cancelado, so hasTtd=true on it
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.stats.totalC100).toBe(4);
    expect(result.data.stats.c100Saidas).toBe(3);
    expect(result.data.stats.c100Entradas).toBe(1);
    expect(result.data.stats.c100Cancelados).toBe(1);
    // Only the last C100 (numDoc=4) has the C110 with TTD
    expect(result.data.stats.c110ComTtd).toBe(1);
  });

  it('handles empty file gracefully', () => {
    const buffer = makeEfdBuffer([]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('0000');
  });

  it('skips unknown register types', () => {
    const buffer = makeEfdBuffer([
      make0000(),
      makeEfdLine('9999', ['FIELD1', 'FIELD2']),
      makeEfdLine('H005', ['X', 'Y']),
      makeC100(),
    ]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.c100s).toHaveLength(1);
  });

  it('attaches multiple C190 items to correct parent C100', () => {
    const buffer = makeEfdBuffer([
      make0000(),
      makeC100({ numDoc: '100' }),
      makeEfdLine('C190', ['100', '5949', '010,00', '100000,00', '100000,00', '10000,00', '0', '0']),
      makeEfdLine('C190', ['100', '6102', '004,00', '50000,00', '50000,00', '2000,00', '0', '0']),
      makeC100({ numDoc: '200', chvNfe: '42260308214494000119550010000200001014848506' }),
      makeEfdLine('C190', ['100', '5102', '012,00', '80000,00', '80000,00', '9600,00', '0', '0']),
    ]);
    const result = parseEfd(buffer);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.c100s[0]!.c190Items).toHaveLength(2);
    expect(result.data.c100s[1]!.c190Items).toHaveLength(1);
    expect(result.data.c100s[1]!.c190Items[0]!.cfop).toBe('5102');
  });
});
