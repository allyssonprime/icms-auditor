import type { EfdC100, EfdC113, EfdC190, EfdE110, EfdCompanyInfo, EfdParseResult } from '../types/efd';

/**
 * Split a pipe-delimited EFD line into fields.
 * Input: "|REG|field1|field2|" → ["REG", "field1", "field2"]
 */
export function splitEfdLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  // Remove leading/trailing pipes and split
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|');
}

/**
 * Parse EFD Brazilian number format.
 * "0156795,43" → 156795.43
 * Empty/whitespace → 0
 */
export function parseEfdNumber(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  return parseFloat(raw.replace(',', '.'));
}

/**
 * Parse EFD date format.
 * "02032026" → "02/03/2026"
 * Returns empty string for invalid input.
 */
export function parseEfdDate(raw: string): string {
  if (!raw || raw.length !== 8) return '';
  return `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
}

function parseC100(fields: string[]): EfdC100 {
  const codSit = fields[5] ?? '';
  return {
    indOper: (fields[1] ?? '0') as '0' | '1',
    indEmit: (fields[2] ?? '0') as '0' | '1',
    codSit,
    numDoc: fields[7] ?? '',
    serie: fields[6] ?? '',
    chvNfe: fields[8] ?? '',
    dtDoc: parseEfdDate(fields[9] ?? ''),
    vlDoc: parseEfdNumber(fields[11] ?? ''),
    vlBcIcms: parseEfdNumber(fields[20] ?? ''),
    vlIcms: parseEfdNumber(fields[21] ?? ''),
    c110Texts: [],
    c113Refs: [],
    c190Items: [],
    isCancelado: codSit === '02',
    hasTtd: false,
    isEstornada: false,
    estornadaPor: null,
    isEstorno: false,
    nfReferenciada: null,
  };
}

function parseC113(fields: string[]): EfdC113 {
  return {
    indOper: fields[1] ?? '',
    numDoc: fields[7] ?? '',
    dtDoc: parseEfdDate(fields[8] ?? ''),
    chvNfe: fields[9] ?? '',
  };
}

function parseC190(fields: string[]): EfdC190 {
  return {
    cst: fields[1] ?? '',
    cfop: fields[2] ?? '',
    aliqIcms: parseEfdNumber(fields[3] ?? ''),
    vlOpr: parseEfdNumber(fields[4] ?? ''),
    vlBcIcms: parseEfdNumber(fields[5] ?? ''),
    vlIcms: parseEfdNumber(fields[6] ?? ''),
  };
}

function parseE110(fields: string[]): EfdE110 {
  return {
    vlTotDebitos: parseEfdNumber(fields[1] ?? ''),
    vlTotCreditos: parseEfdNumber(fields[5] ?? ''),
    vlSldApurado: parseEfdNumber(fields[10] ?? ''),
    vlIcmsRecolher: parseEfdNumber(fields[12] ?? ''),
    vlSldCredorTransportar: parseEfdNumber(fields[13] ?? ''),
  };
}

function parse0000(fields: string[]): EfdCompanyInfo {
  const dtIniRaw = fields[3] ?? '';
  const dtFinRaw = fields[4] ?? '';
  // Competência from DT_INI: "01032026" → "03/2026"
  const competencia = dtIniRaw.length === 8
    ? `${dtIniRaw.slice(2, 4)}/${dtIniRaw.slice(4)}`
    : '';
  return {
    cnpj: fields[6] ?? '',
    nome: fields[5] ?? '',
    uf: fields[8] ?? '',
    competencia,
    dtIni: parseEfdDate(dtIniRaw),
    dtFin: parseEfdDate(dtFinRaw),
  };
}

/**
 * Parse an EFD/SPED Fiscal .txt file from raw bytes (Latin-1 encoded).
 */
export function parseEfd(buffer: ArrayBuffer, fileName?: string): EfdParseResult {
  let text: string;
  try {
    text = new TextDecoder('iso-8859-1').decode(buffer);
  } catch {
    return { success: false, error: `Erro ao decodificar arquivo${fileName ? ` ${fileName}` : ''}: encoding inválido` };
  }

  const lines = text.split(/\r?\n/);
  if (lines.length === 0) {
    return { success: false, error: 'Arquivo EFD vazio' };
  }

  let company: EfdCompanyInfo | null = null;
  const c100s: EfdC100[] = [];
  let currentC100: EfdC100 | null = null;
  let e110: EfdE110 | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = splitEfdLine(line);
    if (fields.length === 0) continue;

    const reg = fields[0];

    switch (reg) {
      case '0000':
        company = parse0000(fields);
        break;

      case 'C100':
        currentC100 = parseC100(fields);
        c100s.push(currentC100);
        break;

      case 'C110':
        if (currentC100) {
          const txt = fields[2] ?? '';
          currentC100.c110Texts.push(txt);
          if (/TTD/i.test(txt)) {
            currentC100.hasTtd = true;
          }
        }
        break;

      case 'C113':
        if (currentC100) {
          const ref = parseC113(fields);
          currentC100.c113Refs.push(ref);
          currentC100.isEstorno = true;
          currentC100.nfReferenciada = ref.numDoc;
        }
        break;

      case 'C190':
        if (currentC100) {
          currentC100.c190Items.push(parseC190(fields));
        }
        break;

      case 'E110':
        e110 = parseE110(fields);
        break;
    }
  }

  if (!company) {
    return { success: false, error: 'Registro 0000 não encontrado no arquivo EFD' };
  }

  // Post-processing: mark estornada NFs
  // Build index by numDoc for quick lookup
  const byNumDoc = new Map<string, EfdC100[]>();
  for (const c100 of c100s) {
    const key = c100.numDoc;
    if (!byNumDoc.has(key)) byNumDoc.set(key, []);
    byNumDoc.get(key)!.push(c100);
  }

  for (const c100 of c100s) {
    for (const ref of c100.c113Refs) {
      const targets = byNumDoc.get(ref.numDoc);
      if (targets) {
        for (const target of targets) {
          if (target !== c100) {
            target.isEstornada = true;
            target.estornadaPor = c100.numDoc;
          }
        }
      }
    }
  }

  // Compute stats
  let c100Saidas = 0;
  let c100Entradas = 0;
  let c100Cancelados = 0;
  let c110ComTtd = 0;
  let c113Count = 0;

  for (const c100 of c100s) {
    if (c100.indOper === '1') {
      c100Saidas++;
      if (c100.hasTtd) c110ComTtd++;
    } else {
      c100Entradas++;
    }
    if (c100.isCancelado) c100Cancelados++;
    c113Count += c100.c113Refs.length;
  }

  return {
    success: true,
    data: {
      company,
      c100s,
      e110,
      stats: {
        totalC100: c100s.length,
        c100Saidas,
        c100Entradas,
        c100Cancelados,
        c110ComTtd,
        c113Count,
      },
    },
  };
}
