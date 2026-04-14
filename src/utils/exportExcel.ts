import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { getCenarios } from '../engine/cenarios.ts';
import { buildReconciliacao } from '../engine/reconciliacao.ts';
import { buildApuracaoMensal, getTaxaFundos, type ConfrontacaoResult, type DadosContabilidade } from '../engine/apuracao.ts';
import { calcularICMSRecolherItem } from '../engine/calculoHelpers.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { bcIntegral } from './formatters.ts';

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseEmissionDate(dhEmi: string): Date | null {
  if (!dhEmi) return null;
  const d = new Date(dhEmi);
  return isNaN(d.getTime()) ? null : d;
}

// --- Styling constants ---
const COLORS = {
  headerBg: '1F4E79',
  headerFont: 'FFFFFF',
  subHeaderBg: '2E75B6',
  subHeaderFont: 'FFFFFF',
  altRowBg: 'F2F7FB',
  borderColor: 'B4C6D9',
  okBg: 'E2EFDA',
  warnBg: 'FFF2CC',
  errorBg: 'FCE4EC',
  divBg: 'FFE0B2',
  infoBg: 'E3F2FD',
  totalRowBg: 'D6E4F0',
};

const FONT_NAME = 'Calibri';

function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { name: FONT_NAME, size: 11, bold: true, color: { argb: COLORS.headerFont } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: COLORS.borderColor } },
      bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
      left: { style: 'thin', color: { argb: COLORS.borderColor } },
      right: { style: 'thin', color: { argb: COLORS.borderColor } },
    },
  };
}

function cellBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
  };
}

function brlFormat(): string {
  return '#,##0.00';
}

function pctFormat(): string {
  return '0.00"%"';
}

function applyHeaderRow(ws: ExcelJS.Worksheet): void {
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    Object.assign(cell, { style: headerStyle() });
  });
}

function applyDataRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number): void {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    row.height = 18;
    row.eachCell(cell => {
      cell.font = { name: FONT_NAME, size: 10 };
      cell.border = cellBorder();
      cell.alignment = { vertical: 'middle' };
    });
    if (r % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRowBg } };
      });
    }
  }
}

function colorizeStatusCell(cell: ExcelJS.Cell, status: string): void {
  const s = status.toUpperCase();
  if (s === 'OK') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.okBg } };
  else if (s === 'AVISO') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warnBg } };
  else if (s === 'ERRO') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.errorBg } };
  else if (s === 'DIVERGENCIA') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.divBg } };
  else if (s === 'INFO') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.infoBg } };
}

function applyTotalRow(ws: ExcelJS.Worksheet, rowNum: number, colCount: number): void {
  const row = ws.getRow(rowNum);
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT_NAME, size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
    cell.border = cellBorder();
    cell.alignment = { vertical: 'middle' };
  }
}

// --- SN/MEI detection ---

function getSimplesNacMei(cnpj: string | undefined, cnpjInfoMap?: Map<string, CnpjInfo>): string {
  if (!cnpj || !cnpjInfoMap) return '-';
  const info = cnpjInfoMap.get(cnpj);
  if (!info) return '-';
  if (info.isMei === true) return 'MEI';
  if (info.simplesOptante === true) return 'Sim';
  if (info.simplesOptante === false) return 'Nao';
  return '-';
}

function naoContribuinte(indIEDest: string): string {
  return indIEDest === '9' ? 'Sim' : 'Nao';
}

// --- Carga efetiva logic ---

/** Fallback quando a aliquota NAO bate no cenario atribuido (divergencia). */
function fallbackCargaPorAliquota(pICMS: number): number {
  if (Math.abs(pICMS - 4) < 0.01) return 1.0;
  if (Math.abs(pICMS - 10) < 0.01) return 3.6;
  if (Math.abs(pICMS - 12) < 0.01) return 3.6;
  if (Math.abs(pICMS - 7) < 0.01) return 3.6;
  if (Math.abs(pICMS - 17) < 0.01) return 3.6;
  if (Math.abs(pICMS - 25) < 0.01) return 3.6;
  if (Math.abs(pICMS - 8.8) < 0.01) return 3.6;
  return 0;
}

function getCargaEfetiva(
  iv: NfeValidation['itensValidados'][0],
  cenariosMap: ReturnType<typeof getCenarios>,
  config: AppConfig,
): number {
  const cenario = cenariosMap[iv.cenario];
  if (!cenario || cenario.cargaEfetiva <= 0) return 0;

  const pICMS = iv.item.pICMS;

  // A carga efetiva eh determinada pelo cenario e pela aliquota destacada,
  // independente de pRedBC. O recolher eh sempre BC integral x carga.
  if (Math.abs(pICMS - 4) < 0.01 && isCobreAco(iv.item.ncm, config.listaCobreAco)) {
    return 0.6;
  }

  if (cenario.aliquotasAceitas.some(a => Math.abs(a - pICMS) < 0.01)) {
    return cenario.cargaEfetiva;
  }

  return fallbackCargaPorAliquota(pICMS);
}

// --- Detail columns ---
interface DetColumn {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
}

function getDetColumns(): DetColumn[] {
  return [
    { header: 'NF-e', key: 'nfe', width: 12 },
    { header: 'Data Emissao', key: 'dhEmi', width: 14 },
    { header: 'Item', key: 'nItem', width: 6 },
    { header: 'NCM', key: 'ncm', width: 12 },
    { header: 'Descricao', key: 'descricao', width: 35 },
    { header: 'CFOP', key: 'cfop', width: 8 },
    { header: 'CST', key: 'cst', width: 8 },
    { header: 'CST Orig', key: 'cstOrig', width: 8 },
    { header: 'Valor Produto (R$)', key: 'vProd', width: 16, numFmt: brlFormat() },
    { header: 'BC ICMS NF (R$)', key: 'vBC', width: 16, numFmt: brlFormat() },
    { header: 'pRedBC (%)', key: 'pRedBC', width: 12, numFmt: pctFormat() },
    { header: 'BC Integral (R$)', key: 'bcIntegral', width: 16, numFmt: brlFormat() },
    { header: 'Aliq. ICMS Dest. (%)', key: 'pICMS', width: 14, numFmt: pctFormat() },
    { header: 'ICMS Destacado (R$)', key: 'vICMS', width: 18, numFmt: brlFormat() },
    { header: 'Aliq. Esperada', key: 'aliqEsperada', width: 14 },
    { header: '% ICMS a Recolher', key: 'pICMSRecolher', width: 16, numFmt: pctFormat() },
    { header: 'ICMS a Recolher (R$)', key: 'vICMSRecolher', width: 18, numFmt: brlFormat() },
    { header: 'CP Codigo', key: 'cpCodigo', width: 12 },
    { header: 'Dest. Simples/MEI', key: 'simplesNacMei', width: 16 },
    { header: 'Dest. Nao Contribuinte', key: 'naoContrib', width: 16 },
    { header: 'Cenario', key: 'cenario', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Confianca', key: 'confianca', width: 12 },
    { header: 'Observacoes', key: 'obs', width: 50 },
    { header: 'Cross-Checks', key: 'crossChecks', width: 40 },
  ];
}

// Column indices (1-based) for formulas
// J=vBC, K=pRedBC, L=bcIntegral, M=pICMS, N=vICMS, P=pICMSRecolher, Q=vICMSRecolher
const COL = { vBC: 'J', pRedBC: 'K', bcIntegral: 'L', pICMS: 'M', vICMS: 'N', pRecolher: 'P', vRecolher: 'Q' };

function buildDetRow(
  r: NfeValidation,
  iv: NfeValidation['itensValidados'][0],
  cenariosMap: ReturnType<typeof getCenarios>,
  config: AppConfig,
  cnpjInfoMap: Map<string, CnpjInfo> | undefined,
  rowNum: number,
): Record<string, unknown> {
  const cenario = cenariosMap[iv.cenario];
  const cargaEfetiva = getCargaEfetiva(iv, cenariosMap, config);
  const destCnpj = r.nfe.dest.cnpj;

  return {
    nfe: r.nfe.numero,
    dhEmi: parseEmissionDate(r.nfe.dhEmi),
    nItem: iv.item.nItem,
    ncm: iv.item.ncm,
    descricao: iv.item.descricao,
    cfop: iv.item.cfop,
    cst: iv.item.cst,
    cstOrig: iv.item.cstOrig,
    vProd: iv.item.vProd,
    vBC: iv.item.vBC,
    pRedBC: iv.item.pRedBC || 0,
    // BC Integral: =IF(pRedBC>0, vBC/(1-pRedBC/100), vBC)
    bcIntegral: { formula: `IF(${COL.pRedBC}${rowNum}>0,${COL.vBC}${rowNum}/(1-${COL.pRedBC}${rowNum}/100),${COL.vBC}${rowNum})` },
    pICMS: iv.item.pICMS,
    // ICMS Destacado = vBC * pICMS / 100
    vICMS: { formula: `${COL.vBC}${rowNum}*${COL.pICMS}${rowNum}/100` },
    aliqEsperada: cenario ? cenario.aliquotasAceitas.join('/') : '-',
    pICMSRecolher: cargaEfetiva,
    // ICMS Recolher: SEMPRE BC Integral × carga efetiva. A reducao de BC
    // nao reduz a obrigacao de recolhimento sob TTD 410.
    vICMSRecolher: {
      formula: `${COL.bcIntegral}${rowNum}*${COL.pRecolher}${rowNum}/100`,
    },
    cpCodigo: iv.item.cCredPresumido || '',
    simplesNacMei: getSimplesNacMei(destCnpj, cnpjInfoMap),
    naoContrib: naoContribuinte(r.nfe.dest.indIEDest),
    cenario: iv.cenario,
    status: iv.statusFinal,
    confianca: iv.confianca,
    obs: iv.resultados
      .filter(res => res.status !== 'OK')
      .map(res => `[${res.regra}] ${res.mensagem}`)
      .join(' | '),
    crossChecks: iv.crossChecks
      .map(ck => `[${ck.severity}] ${ck.label}`)
      .join(' | '),
  };
}

function addDetSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  rows: Array<{ r: NfeValidation; iv: NfeValidation['itensValidados'][0] }>,
  cenariosMap: ReturnType<typeof getCenarios>,
  config: AppConfig,
  cnpjInfoMap?: Map<string, CnpjInfo>,
): void {
  if (rows.length === 0) return;
  const ws = wb.addWorksheet(sheetName);
  const cols = getDetColumns();
  ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }));

  rows.forEach((item, idx) => {
    const rowNum = idx + 2;
    const data = buildDetRow(item.r, item.iv, cenariosMap, config, cnpjInfoMap, rowNum);
    const row = ws.addRow(data);

    cols.forEach((colDef, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      if (colDef.numFmt) cell.numFmt = colDef.numFmt;
    });
  });

  applyHeaderRow(ws);
  applyDataRows(ws, 2, rows.length + 1);

  // Colorize status column
  const statusColIdx = cols.findIndex(c => c.key === 'status') + 1;
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = ws.getRow(r).getCell(statusColIdx);
    colorizeStatusCell(cell, String(cell.value ?? ''));
  }

  // Destaca linhas orfas (cenario DESCONHECIDO/VEDADO): celula cenario em
  // vermelho e negrito para diferenciar visualmente das classificacoes validas.
  const cenarioColIdx = cols.findIndex(c => c.key === 'cenario') + 1;
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = ws.getRow(r).getCell(cenarioColIdx);
    const val = String(cell.value ?? '');
    if (val === 'DESCONHECIDO' || val === 'VEDADO') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.errorBg } };
      cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'C62828' } };
    }
  }

  // Date format
  const dateColIdx = cols.findIndex(c => c.key === 'dhEmi') + 1;
  for (let r = 2; r <= rows.length + 1; r++) {
    ws.getRow(r).getCell(dateColIdx).numFmt = 'DD/MM/YYYY';
  }

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + cols.length)}1` };
}

export async function exportToExcel(
  results: NfeValidation[],
  regras: RegrasConfig,
  config: AppConfig,
  cnpjInfoMap?: Map<string, CnpjInfo>,
  crossValidation?: import('../types/crossValidation').CrossValidationResult,
): Promise<void> {
  const cenariosMap = getCenarios(regras);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ICMS Auditor';
  wb.created = new Date();

  // ============================================================
  // Aba 1: RESUMO
  // ============================================================
  const wsResumo = wb.addWorksheet('Resumo');
  wsResumo.columns = [
    { header: 'NF-e', key: 'nfe', width: 12 },
    { header: 'Data Emissao', key: 'dhEmi', width: 14 },
    { header: 'Serie', key: 'serie', width: 8 },
    { header: 'Emitente CNPJ', key: 'emitCnpj', width: 18 },
    { header: 'Emitente', key: 'emitNome', width: 30 },
    { header: 'Dest CNPJ/CPF', key: 'destDoc', width: 18 },
    { header: 'Destinatario', key: 'destNome', width: 30 },
    { header: 'UF', key: 'uf', width: 6 },
    { header: 'IE', key: 'ie', width: 16 },
    { header: 'indIEDest', key: 'indIEDest', width: 10 },
    { header: 'Qtd Itens', key: 'qtdItens', width: 10 },
    { header: 'OK', key: 'ok', width: 6 },
    { header: 'Info', key: 'info', width: 6 },
    { header: 'Avisos', key: 'avisos', width: 8 },
    { header: 'Diverg.', key: 'diverg', width: 8 },
    { header: 'Erros', key: 'erros', width: 8 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Total BC (R$)', key: 'totalBC', width: 16 },
    { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
    { header: '% ICMS Destacado', key: 'pICMSDest', width: 16 },
    { header: 'ICMS Recolher (R$)', key: 'icmsRecolher', width: 18 },
    { header: '% ICMS Recolher', key: 'pICMSRecolher', width: 16 },
    { header: 'Fundos 0,4% (R$)', key: 'fundos', width: 16 },
    { header: 'Total Recolher (R$)', key: 'totalRecolher', width: 18 },
  ];

  results.forEach((r, idx) => {
    const rowNum = idx + 2;
    const row = wsResumo.addRow({
      nfe: r.nfe.numero,
      dhEmi: parseEmissionDate(r.nfe.dhEmi),
      serie: r.nfe.serie,
      emitCnpj: r.nfe.emitCnpj || '',
      emitNome: r.nfe.emitNome || '',
      destDoc: r.nfe.dest.cnpj || r.nfe.dest.cpf || '',
      destNome: r.nfe.dest.nome,
      uf: r.nfe.dest.uf,
      ie: r.nfe.dest.ie || '',
      indIEDest: r.nfe.dest.indIEDest,
      qtdItens: r.itensValidados.length,
      ok: r.itensValidados.filter(i => i.statusFinal === 'OK').length,
      info: r.itensValidados.filter(i => i.statusFinal === 'INFO').length,
      avisos: r.itensValidados.filter(i => i.statusFinal === 'AVISO').length,
      diverg: r.itensValidados.filter(i => i.statusFinal === 'DIVERGENCIA').length,
      erros: r.itensValidados.filter(i => i.statusFinal === 'ERRO').length,
      status: r.statusFinal,
      totalBC: r.totalBC,
      icmsDest: r.totalICMSDestacado,
      pICMSDest: { formula: `IF(R${rowNum}=0,0,S${rowNum}/R${rowNum}*100)` },
      icmsRecolher: r.totalICMSRecolher,
      pICMSRecolher: { formula: `IF(R${rowNum}=0,0,U${rowNum}/R${rowNum}*100)` },
      fundos: r.totalFundos,
      totalRecolher: r.totalRecolherComFundos,
    });

    row.getCell(18).numFmt = brlFormat();
    row.getCell(19).numFmt = brlFormat();
    row.getCell(20).numFmt = pctFormat();
    row.getCell(21).numFmt = brlFormat();
    row.getCell(22).numFmt = pctFormat();
    row.getCell(23).numFmt = brlFormat();
    row.getCell(24).numFmt = brlFormat();
    row.getCell(2).numFmt = 'DD/MM/YYYY';
  });

  applyHeaderRow(wsResumo);
  applyDataRows(wsResumo, 2, results.length + 1);

  for (let r = 2; r <= results.length + 1; r++) {
    colorizeStatusCell(wsResumo.getRow(r).getCell(17), String(wsResumo.getRow(r).getCell(17).value ?? ''));
  }

  wsResumo.autoFilter = { from: 'A1', to: 'X1' };

  // ============================================================
  // Aba 2: DETALHAMENTO (todos os itens)
  // ============================================================
  const allDetItems = results.flatMap(r =>
    r.itensValidados.map(iv => ({ r, iv })),
  );
  addDetSheet(wb, 'Detalhamento', allDetItems, cenariosMap, config, cnpjInfoMap);

  // ============================================================
  // Abas por CST
  // ============================================================
  const cstGroups = new Map<string, Array<{ r: NfeValidation; iv: NfeValidation['itensValidados'][0] }>>();
  for (const item of allDetItems) {
    const cst = item.iv.item.cst || 'SEM_CST';
    if (!cstGroups.has(cst)) cstGroups.set(cst, []);
    cstGroups.get(cst)!.push(item);
  }
  const sortedCSTs = [...cstGroups.keys()].sort();
  for (const cst of sortedCSTs) {
    const sheetName = `CST ${cst}`.substring(0, 31);
    addDetSheet(wb, sheetName, cstGroups.get(cst)!, cenariosMap, config, cnpjInfoMap);
  }

  // ============================================================
  // Aba: RESUMO POR TTD (agrupado por ref TTD)
  // ============================================================
  {
    const wsTTD = wb.addWorksheet('Resumo por TTD');
    wsTTD.columns = [
      { header: 'Ref TTD', key: 'refTTD', width: 18 },
      { header: 'Cenarios', key: 'cenarios', width: 20 },
      { header: 'Descricao', key: 'descricao', width: 35 },
      { header: 'Qtd Itens', key: 'qtdItens', width: 10 },
      { header: 'Qtd NF-es', key: 'qtdNfes', width: 10 },
      { header: 'BC Integral (R$)', key: 'bcIntegral', width: 18 },
      { header: 'BC NF (R$)', key: 'bcNf', width: 16 },
      { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
      { header: 'Carga Efetiva (%)', key: 'carga', width: 14 },
      { header: 'ICMS a Recolher (R$)', key: 'icmsRecolher', width: 18 },
      { header: 'Fundos (R$)', key: 'fundos', width: 14 },
      { header: 'Total (R$)', key: 'total', width: 16 },
    ];

    // Aggregate by TTD ref
    const ttdMap = new Map<string, {
      refTTD: string; cenarios: Set<string>; descricao: string;
      qtdItens: number; nfes: Set<string>;
      bcIntegral: number; bcNf: number; icmsDest: number;
      carga: number; icmsRecolher: number; fundos: number;
    }>();

    for (const item of allDetItems) {
      const cenario = cenariosMap[item.iv.cenario];
      const ref = cenario?.refTTD || 'Sem TTD';
      const carga = getCargaEfetiva(item.iv, cenariosMap, config);
      const bcInt = bcIntegral(item.iv.item.vBC, item.iv.item.pRedBC);
      const isCA = isCobreAco(item.iv.item.ncm, config.listaCobreAco);
      const recolher = cenario
        ? calcularICMSRecolherItem(item.iv.item, cenario, isCA)
        : 0;
      const fundosPct = cenario?.fundos ?? 0;
      const fundosVal = fundosPct > 0 ? bcInt * (fundosPct / 100) : 0;

      let entry = ttdMap.get(ref);
      if (!entry) {
        entry = {
          refTTD: ref,
          cenarios: new Set(),
          descricao: cenario?.nome ?? '-',
          qtdItens: 0, nfes: new Set(),
          bcIntegral: 0, bcNf: 0, icmsDest: 0,
          carga, icmsRecolher: 0, fundos: 0,
        };
        ttdMap.set(ref, entry);
      }
      entry.cenarios.add(item.iv.cenario);
      entry.qtdItens++;
      entry.nfes.add(item.r.nfe.numero);
      entry.bcIntegral += bcInt;
      entry.bcNf += item.iv.item.vBC;
      entry.icmsDest += item.iv.item.vICMS;
      entry.icmsRecolher += recolher;
      entry.fundos += fundosVal;
    }

    let ttdRowCount = 0;
    const ttdTotals = { bcIntegral: 0, bcNf: 0, icmsDest: 0, icmsRecolher: 0, fundos: 0, total: 0 };
    for (const [, t] of [...ttdMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const total = t.icmsRecolher + t.fundos;
      const row = wsTTD.addRow({
        refTTD: t.refTTD,
        cenarios: [...t.cenarios].join(', '),
        descricao: t.descricao,
        qtdItens: t.qtdItens,
        qtdNfes: t.nfes.size,
        bcIntegral: t.bcIntegral,
        bcNf: t.bcNf,
        icmsDest: t.icmsDest,
        carga: t.carga > 0 ? t.carga : '-',
        icmsRecolher: t.icmsRecolher,
        fundos: t.fundos,
        total,
      });
      row.getCell(6).numFmt = brlFormat();
      row.getCell(7).numFmt = brlFormat();
      row.getCell(8).numFmt = brlFormat();
      if (t.carga > 0) row.getCell(9).numFmt = pctFormat();
      row.getCell(10).numFmt = brlFormat();
      row.getCell(11).numFmt = brlFormat();
      row.getCell(12).numFmt = brlFormat();
      ttdRowCount++;
      ttdTotals.bcIntegral += t.bcIntegral;
      ttdTotals.bcNf += t.bcNf;
      ttdTotals.icmsDest += t.icmsDest;
      ttdTotals.icmsRecolher += t.icmsRecolher;
      ttdTotals.fundos += t.fundos;
      ttdTotals.total += total;
    }

    // Total row
    const totalRow = wsTTD.addRow({
      refTTD: 'TOTAL',
      bcIntegral: ttdTotals.bcIntegral,
      bcNf: ttdTotals.bcNf,
      icmsDest: ttdTotals.icmsDest,
      icmsRecolher: ttdTotals.icmsRecolher,
      fundos: ttdTotals.fundos,
      total: ttdTotals.total,
    });
    totalRow.getCell(6).numFmt = brlFormat();
    totalRow.getCell(7).numFmt = brlFormat();
    totalRow.getCell(8).numFmt = brlFormat();
    totalRow.getCell(10).numFmt = brlFormat();
    totalRow.getCell(11).numFmt = brlFormat();
    totalRow.getCell(12).numFmt = brlFormat();

    applyHeaderRow(wsTTD);
    applyDataRows(wsTTD, 2, ttdRowCount + 1);
    applyTotalRow(wsTTD, ttdRowCount + 2, 12);
    wsTTD.autoFilter = { from: 'A1', to: 'L1' };
  }

  // ============================================================
  // Aba: RESUMO POR ALIQUOTA
  // ============================================================
  {
    const wsAliq = wb.addWorksheet('Resumo por Aliquota');
    wsAliq.columns = [
      { header: 'Aliquota (%)', key: 'aliquota', width: 14 },
      { header: 'Qtd Itens', key: 'qtdItens', width: 10 },
      { header: 'Qtd NF-es', key: 'qtdNfes', width: 10 },
      { header: 'BC Integral (R$)', key: 'bcIntegral', width: 18 },
      { header: 'BC NF (R$)', key: 'bcNf', width: 16 },
      { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
      { header: 'Carga Efetiva (%)', key: 'carga', width: 14 },
      { header: 'ICMS a Recolher (R$)', key: 'icmsRecolher', width: 18 },
      { header: 'Fundos (R$)', key: 'fundos', width: 14 },
      { header: 'Total (R$)', key: 'total', width: 16 },
    ];

    const aliqMap = new Map<string, {
      label: string; qtdItens: number; nfes: Set<string>;
      bcIntegral: number; bcNf: number; icmsDest: number;
      carga: number; icmsRecolher: number; fundos: number;
    }>();

    for (const item of allDetItems) {
      const pICMS = item.iv.item.pICMS;
      const isAcoCobre = Math.abs(pICMS - 4) < 0.01 && isCobreAco(item.iv.item.ncm, config.listaCobreAco);
      const label = isAcoCobre ? '4% Aco/Cobre' : `${pICMS}%`;
      const carga = getCargaEfetiva(item.iv, cenariosMap, config);
      const cenario = cenariosMap[item.iv.cenario];
      const bcInt = bcIntegral(item.iv.item.vBC, item.iv.item.pRedBC);
      const recolher = cenario
        ? calcularICMSRecolherItem(item.iv.item, cenario, isAcoCobre)
        : 0;
      const fundosPct = cenario?.fundos ?? 0;
      const fundosVal = fundosPct > 0 ? bcInt * (fundosPct / 100) : 0;

      let entry = aliqMap.get(label);
      if (!entry) {
        entry = {
          label, qtdItens: 0, nfes: new Set(),
          bcIntegral: 0, bcNf: 0, icmsDest: 0,
          carga, icmsRecolher: 0, fundos: 0,
        };
        aliqMap.set(label, entry);
      }
      entry.qtdItens++;
      entry.nfes.add(item.r.nfe.numero);
      entry.bcIntegral += bcInt;
      entry.bcNf += item.iv.item.vBC;
      entry.icmsDest += item.iv.item.vICMS;
      entry.icmsRecolher += recolher;
      entry.fundos += fundosVal;
    }

    const sortOrder = ['4% Aco/Cobre', '4%', '7%', '8.8%', '10%', '12%', '17%', '25%'];
    const sorted = [...aliqMap.entries()].sort((a, b) => {
      const ia = sortOrder.indexOf(a[0]);
      const ib = sortOrder.indexOf(b[0]);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a[0].localeCompare(b[0]);
    });

    let aliqRowCount = 0;
    const aliqTotals = { bcIntegral: 0, bcNf: 0, icmsDest: 0, icmsRecolher: 0, fundos: 0, total: 0 };
    for (const [, a] of sorted) {
      const total = a.icmsRecolher + a.fundos;
      const row = wsAliq.addRow({
        aliquota: a.label,
        qtdItens: a.qtdItens,
        qtdNfes: a.nfes.size,
        bcIntegral: a.bcIntegral,
        bcNf: a.bcNf,
        icmsDest: a.icmsDest,
        carga: a.carga > 0 ? a.carga : '-',
        icmsRecolher: a.icmsRecolher,
        fundos: a.fundos,
        total,
      });
      row.getCell(4).numFmt = brlFormat();
      row.getCell(5).numFmt = brlFormat();
      row.getCell(6).numFmt = brlFormat();
      if (a.carga > 0) row.getCell(7).numFmt = pctFormat();
      row.getCell(8).numFmt = brlFormat();
      row.getCell(9).numFmt = brlFormat();
      row.getCell(10).numFmt = brlFormat();
      aliqRowCount++;
      aliqTotals.bcIntegral += a.bcIntegral;
      aliqTotals.bcNf += a.bcNf;
      aliqTotals.icmsDest += a.icmsDest;
      aliqTotals.icmsRecolher += a.icmsRecolher;
      aliqTotals.fundos += a.fundos;
      aliqTotals.total += total;
    }

    const totalRow = wsAliq.addRow({
      aliquota: 'TOTAL',
      bcIntegral: aliqTotals.bcIntegral,
      bcNf: aliqTotals.bcNf,
      icmsDest: aliqTotals.icmsDest,
      icmsRecolher: aliqTotals.icmsRecolher,
      fundos: aliqTotals.fundos,
      total: aliqTotals.total,
    });
    totalRow.getCell(4).numFmt = brlFormat();
    totalRow.getCell(5).numFmt = brlFormat();
    totalRow.getCell(6).numFmt = brlFormat();
    totalRow.getCell(8).numFmt = brlFormat();
    totalRow.getCell(9).numFmt = brlFormat();
    totalRow.getCell(10).numFmt = brlFormat();

    applyHeaderRow(wsAliq);
    applyDataRows(wsAliq, 2, aliqRowCount + 1);
    applyTotalRow(wsAliq, aliqRowCount + 2, 10);
    wsAliq.autoFilter = { from: 'A1', to: 'J1' };
  }

  // ============================================================
  // Aba: RESUMO POR CENARIO (reconciliacao top-down)
  // Agrega por id de cenario (B1, B2, B3, A1, ...) com CP calculado
  // explicito. Serve para bater o total geral contra o livro fiscal
  // / SPED sem precisar percorrer o detalhamento linha-a-linha.
  // ============================================================
  {
    const wsCen = wb.addWorksheet('Resumo por Cenario');
    wsCen.columns = [
      { header: 'Cenario', key: 'cenario', width: 10 },
      { header: 'Descricao', key: 'descricao', width: 38 },
      { header: 'Ref TTD', key: 'refTTD', width: 14 },
      { header: 'Qtd Itens', key: 'qtdItens', width: 10 },
      { header: 'Qtd NF-es', key: 'qtdNfes', width: 10 },
      { header: 'BC Integral (R$)', key: 'bcIntegral', width: 18 },
      { header: 'BC NF (R$)', key: 'bcNf', width: 16 },
      { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
      { header: 'Carga Efetiva (%)', key: 'carga', width: 14 },
      { header: 'ICMS a Recolher (R$)', key: 'icmsRecolher', width: 18 },
      { header: 'CP Calculado (R$)', key: 'cpCalculado', width: 18 },
      { header: 'CP Declarado XML (R$)', key: 'cpDeclarado', width: 20 },
      { header: 'Fundos (R$)', key: 'fundos', width: 14 },
      { header: 'Total a Recolher (R$)', key: 'total', width: 20 },
    ];

    const cenMap = new Map<string, {
      cenario: string; descricao: string; refTTD: string;
      qtdItens: number; nfes: Set<string>;
      bcIntegral: number; bcNf: number; icmsDest: number;
      icmsRecolher: number; cpCalculado: number; cpDeclarado: number;
      fundos: number;
    }>();

    for (const item of allDetItems) {
      const cenId = item.iv.cenario || 'SEM_CENARIO';
      const cenario = cenariosMap[cenId];
      const carga = getCargaEfetiva(item.iv, cenariosMap, config);
      const bcInt = bcIntegral(item.iv.item.vBC, item.iv.item.pRedBC);
      const isCA = isCobreAco(item.iv.item.ncm, config.listaCobreAco);
      const recolher = cenario
        ? calcularICMSRecolherItem(item.iv.item, cenario, isCA)
        : 0;
      // CP = diferenca entre ICMS integral (bcInt * pICMS/100) e ICMS a recolher.
      // Calculado independente de pRedBC: recolher e CP sao sempre sobre BC
      // integral, mesmo quando ha reducao de BC declarada.
      const icmsIntegral = bcInt * (item.iv.item.pICMS / 100);
      const cpCalc =
        carga > 0 && item.iv.item.pICMS > carga
          ? icmsIntegral - recolher
          : 0;
      const fundosPct = cenario?.fundos ?? 0;
      const fundosVal = fundosPct > 0 ? bcInt * (fundosPct / 100) : 0;

      let entry = cenMap.get(cenId);
      if (!entry) {
        entry = {
          cenario: cenId,
          descricao: cenario?.nome ?? '-',
          refTTD: cenario?.refTTD ?? '-',
          qtdItens: 0, nfes: new Set(),
          bcIntegral: 0, bcNf: 0, icmsDest: 0,
          icmsRecolher: 0, cpCalculado: 0, cpDeclarado: 0,
          fundos: 0,
        };
        cenMap.set(cenId, entry);
      }
      entry.qtdItens++;
      entry.nfes.add(item.r.nfe.numero);
      entry.bcIntegral += bcInt;
      entry.bcNf += item.iv.item.vBC;
      entry.icmsDest += item.iv.item.vICMS;
      entry.icmsRecolher += recolher;
      entry.cpCalculado += cpCalc;
      entry.cpDeclarado += item.iv.item.vCredPresumido || 0;
      entry.fundos += fundosVal;
    }

    // Ordenar: cenarios A* primeiro, depois B*, depois outros alfabetico
    const sortedCen = [...cenMap.values()].sort((a, b) => a.cenario.localeCompare(b.cenario));

    let cenRowCount = 0;
    const cenTotals = {
      qtdItens: 0, bcIntegral: 0, bcNf: 0, icmsDest: 0,
      icmsRecolher: 0, cpCalculado: 0, cpDeclarado: 0, fundos: 0, total: 0,
    };
    const allNfes = new Set<string>();
    for (const c of sortedCen) {
      const total = c.icmsRecolher + c.fundos;
      const row = wsCen.addRow({
        cenario: c.cenario,
        descricao: c.descricao,
        refTTD: c.refTTD,
        qtdItens: c.qtdItens,
        qtdNfes: c.nfes.size,
        bcIntegral: c.bcIntegral,
        bcNf: c.bcNf,
        icmsDest: c.icmsDest,
        carga: c.qtdItens > 0 ? (c.icmsRecolher / c.bcIntegral) * 100 : 0,
        icmsRecolher: c.icmsRecolher,
        cpCalculado: c.cpCalculado,
        cpDeclarado: c.cpDeclarado,
        fundos: c.fundos,
        total,
      });
      row.getCell(6).numFmt = brlFormat();
      row.getCell(7).numFmt = brlFormat();
      row.getCell(8).numFmt = brlFormat();
      row.getCell(9).numFmt = pctFormat();
      row.getCell(10).numFmt = brlFormat();
      row.getCell(11).numFmt = brlFormat();
      row.getCell(12).numFmt = brlFormat();
      row.getCell(13).numFmt = brlFormat();
      row.getCell(14).numFmt = brlFormat();
      cenRowCount++;
      cenTotals.qtdItens += c.qtdItens;
      for (const n of c.nfes) allNfes.add(n);
      cenTotals.bcIntegral += c.bcIntegral;
      cenTotals.bcNf += c.bcNf;
      cenTotals.icmsDest += c.icmsDest;
      cenTotals.icmsRecolher += c.icmsRecolher;
      cenTotals.cpCalculado += c.cpCalculado;
      cenTotals.cpDeclarado += c.cpDeclarado;
      cenTotals.fundos += c.fundos;
      cenTotals.total += total;
    }

    const totalRow = wsCen.addRow({
      cenario: 'TOTAL',
      descricao: 'Soma geral para conferencia vs livro fiscal / SPED',
      refTTD: '',
      qtdItens: cenTotals.qtdItens,
      qtdNfes: allNfes.size,
      bcIntegral: cenTotals.bcIntegral,
      bcNf: cenTotals.bcNf,
      icmsDest: cenTotals.icmsDest,
      carga: cenTotals.bcIntegral > 0 ? (cenTotals.icmsRecolher / cenTotals.bcIntegral) * 100 : 0,
      icmsRecolher: cenTotals.icmsRecolher,
      cpCalculado: cenTotals.cpCalculado,
      cpDeclarado: cenTotals.cpDeclarado,
      fundos: cenTotals.fundos,
      total: cenTotals.total,
    });
    totalRow.getCell(6).numFmt = brlFormat();
    totalRow.getCell(7).numFmt = brlFormat();
    totalRow.getCell(8).numFmt = brlFormat();
    totalRow.getCell(9).numFmt = pctFormat();
    totalRow.getCell(10).numFmt = brlFormat();
    totalRow.getCell(11).numFmt = brlFormat();
    totalRow.getCell(12).numFmt = brlFormat();
    totalRow.getCell(13).numFmt = brlFormat();
    totalRow.getCell(14).numFmt = brlFormat();

    applyHeaderRow(wsCen);
    applyDataRows(wsCen, 2, cenRowCount + 1);
    applyTotalRow(wsCen, cenRowCount + 2, 14);
    wsCen.autoFilter = { from: 'A1', to: 'N1' };
  }

  // ============================================================
  // Aba: REGRAS
  // ============================================================
  const wsRegras = wb.addWorksheet('Regras');
  wsRegras.columns = [
    { header: 'NF-e', key: 'nfe', width: 12 },
    { header: 'Data Emissao', key: 'dhEmi', width: 14 },
    { header: 'Item', key: 'nItem', width: 6 },
    { header: 'NCM', key: 'ncm', width: 12 },
    { header: 'Regra', key: 'regra', width: 25 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Mensagem', key: 'mensagem', width: 60 },
  ];
  let regrasRowCount = 0;
  results.forEach(r => {
    r.itensValidados.forEach(iv => {
      iv.resultados.forEach(res => {
        const row = wsRegras.addRow({
          nfe: r.nfe.numero,
          dhEmi: parseEmissionDate(r.nfe.dhEmi),
          nItem: iv.item.nItem,
          ncm: iv.item.ncm,
          regra: res.regra,
          status: res.status,
          mensagem: res.mensagem,
        });
        row.getCell(2).numFmt = 'DD/MM/YYYY';
        regrasRowCount++;
      });
    });
  });
  applyHeaderRow(wsRegras);
  applyDataRows(wsRegras, 2, regrasRowCount + 1);
  for (let r = 2; r <= regrasRowCount + 1; r++) {
    colorizeStatusCell(wsRegras.getRow(r).getCell(6), String(wsRegras.getRow(r).getCell(6).value ?? ''));
  }
  wsRegras.autoFilter = { from: 'A1', to: 'G1' };

  // ============================================================
  // Aba: FUNDOS E TOTAIS
  // ============================================================
  const wsFundos = wb.addWorksheet('Fundos e Totais');
  wsFundos.columns = [
    { header: 'NF-e', key: 'nfe', width: 12 },
    { header: 'Data Emissao', key: 'dhEmi', width: 14 },
    { header: 'Destinatario', key: 'destNome', width: 30 },
    { header: 'UF', key: 'uf', width: 6 },
    { header: 'Total BC (R$)', key: 'totalBC', width: 16 },
    { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
    { header: 'ICMS Recolher (R$)', key: 'icmsRecolher', width: 18 },
    { header: 'Fundos 0,4% (R$)', key: 'fundos', width: 16 },
    { header: 'Total Recolher + Fundos (R$)', key: 'total', width: 22 },
  ];
  results.forEach(r => {
    const row = wsFundos.addRow({
      nfe: r.nfe.numero,
      dhEmi: parseEmissionDate(r.nfe.dhEmi),
      destNome: r.nfe.dest.nome,
      uf: r.nfe.dest.uf,
      totalBC: r.totalBC,
      icmsDest: r.totalICMSDestacado,
      icmsRecolher: r.totalICMSRecolher,
      fundos: r.totalFundos,
      total: r.totalRecolherComFundos,
    });
    row.getCell(2).numFmt = 'DD/MM/YYYY';
    row.getCell(5).numFmt = brlFormat();
    row.getCell(6).numFmt = brlFormat();
    row.getCell(7).numFmt = brlFormat();
    row.getCell(8).numFmt = brlFormat();
    row.getCell(9).numFmt = brlFormat();
  });
  applyHeaderRow(wsFundos);
  applyDataRows(wsFundos, 2, results.length + 1);
  wsFundos.autoFilter = { from: 'A1', to: 'I1' };

  // ============================================================
  // Aba: RECONCILIACAO DIME
  // ============================================================
  const reconciliacao = buildReconciliacao(results, regras, config);
  const wsReconc = wb.addWorksheet('Reconciliacao DIME');
  const baseCols = [
    { header: 'Ref TTD', key: 'refTTD', width: 12 },
    { header: 'Cenarios', key: 'cenarios', width: 20 },
    { header: 'Descricao', key: 'descricao', width: 35 },
    { header: 'Qtd Itens', key: 'qtdItens', width: 10 },
    { header: 'Qtd NF-es', key: 'qtdNfes', width: 10 },
    { header: 'BC ICMS (R$)', key: 'totalBC', width: 16 },
    { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
    { header: 'Carga %', key: 'carga', width: 10 },
    { header: 'ICMS Recolher (R$)', key: 'icmsRecolher', width: 18 },
  ];
  const camexRecolherCol = { header: 'Recolher 2,1% CAMEX (R$)', key: 'icmsRecolher21', width: 22 };
  const tailCols = [
    { header: 'Fundos (R$)', key: 'fundos', width: 14 },
    { header: 'Total (R$)', key: 'total', width: 16 },
  ];
  const camexTotalCol = { header: 'Total 2,1% CAMEX (R$)', key: 'total21', width: 22 };
  const divCol = { header: 'Divergencia?', key: 'div', width: 14 };

  wsReconc.columns = reconciliacao.temCAMEX
    ? [...baseCols, camexRecolherCol, ...tailCols, camexTotalCol, divCol]
    : [...baseCols, ...tailCols, divCol];

  reconciliacao.porTTD.forEach(t => {
    const base: Record<string, unknown> = {
      refTTD: t.refTTD,
      cenarios: t.cenarios.join(', '),
      descricao: t.descricao,
      qtdItens: t.qtdItens,
      qtdNfes: t.qtdNfes,
      totalBC: t.totalBC,
      icmsDest: t.totalICMSDestacado,
      carga: t.cargaEfetiva < 0 ? 'N/A' : t.cargaEfetiva > 0 ? `${t.cargaEfetiva}%` : '-',
      icmsRecolher: t.totalICMSRecolher,
      fundos: t.totalFundos,
      total: t.totalRecolherComFundos,
      div: t.temDivergencia ? 'SIM' : '',
    };
    if (reconciliacao.temCAMEX) {
      base.icmsRecolher21 = t.temCAMEX ? t.totalICMSRecolher21 : null;
      base.total21 = t.temCAMEX ? t.totalRecolherComFundos21 : null;
    }
    const row = wsReconc.addRow(base);
    // Aplica numFmt nos campos numericos por chave (robusto a ordem de coluna)
    const moneyKeys = reconciliacao.temCAMEX
      ? ['totalBC', 'icmsDest', 'icmsRecolher', 'icmsRecolher21', 'fundos', 'total', 'total21']
      : ['totalBC', 'icmsDest', 'icmsRecolher', 'fundos', 'total'];
    moneyKeys.forEach(key => {
      const cell = row.getCell(key);
      cell.numFmt = brlFormat();
    });
  });
  applyHeaderRow(wsReconc);
  applyDataRows(wsReconc, 2, reconciliacao.porTTD.length + 1);
  const lastColLetter = String.fromCharCode(64 + wsReconc.columnCount);
  for (let r = 2; r <= reconciliacao.porTTD.length + 1; r++) {
    const divCell = wsReconc.getRow(r).getCell('div');
    if (divCell.value === 'SIM') {
      divCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.errorBg } };
      divCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'C62828' } };
    }
  }
  wsReconc.autoFilter = { from: 'A1', to: `${lastColLetter}1` };

  // ============================================================
  // Aba: VALIDAÇÃO EFD (cross-validation, optional)
  // ============================================================
  if (crossValidation) {
    const wsCV = wb.addWorksheet('Validacao EFD');
    const cv = crossValidation;

    // Summary rows
    const summaryData = [
      ['Competencia', cv.competencia],
      ['Status', cv.isConsistent ? 'CONVERGENTE' : 'DIVERGENCIAS ENCONTRADAS'],
      [''],
      ['NFs XML', cv.totalXml],
      ['NFs EFD (saidas)', cv.totalEfd],
      ['Em ambos (OK)', cv.matched],
      ['Divergentes (valor)', cv.valueDivergent],
      ['So XML', cv.onlyXml],
      ['So EFD', cv.onlyEfd],
      [''],
      ['Debitos XML (soma vICMS)', cv.xmlTotalDebitos],
      ['Debitos EFD (E110)', cv.efdTotalDebitos],
      ['Diferenca', cv.diffTotalDebitos],
    ];

    for (const row of summaryData) {
      const r = wsCV.addRow(row);
      r.font = { name: FONT_NAME, size: 10 };
      if (row[0] === 'Status') {
        r.getCell(2).font = {
          name: FONT_NAME, size: 10, bold: true,
          color: { argb: cv.isConsistent ? '2E7D32' : 'C62828' },
        };
      }
      if (typeof row[1] === 'number') {
        r.getCell(2).numFmt = brlFormat();
      }
    }
    wsCV.getCell('A1').font = { name: FONT_NAME, size: 10, bold: true };

    // Blank row before detail table
    wsCV.addRow([]);

    // Detail table header
    const detailHeaders = ['NF', 'Serie', 'Status', 'BC XML', 'BC EFD', 'Diff BC', 'ICMS XML', 'ICMS EFD', 'Diff ICMS', 'Flags'];
    const headerRow = wsCV.addRow(detailHeaders);
    const detailHeaderIdx = headerRow.number;
    headerRow.eachCell((cell) => {
      Object.assign(cell, { style: headerStyle() });
    });
    headerRow.height = 28;

    // Detail rows
    const statusLabels: Record<string, string> = { matched: 'OK', value_divergent: 'Divergente', only_xml: 'So XML', only_efd: 'So EFD' };
    const statusColors: Record<string, string> = { matched: COLORS.okBg, value_divergent: COLORS.warnBg, only_xml: COLORS.errorBg, only_efd: COLORS.infoBg };

    for (const m of cv.matches) {
      const r = wsCV.addRow([
        m.numDoc,
        m.serie,
        statusLabels[m.matchStatus] ?? m.matchStatus,
        m.xmlVlBcIcms ?? '',
        m.efdVlBcIcms ?? '',
        m.diffBcIcms ?? '',
        m.xmlVlIcms ?? '',
        m.efdVlIcms ?? '',
        m.diffIcms ?? '',
        m.flagDivergences.join(', '),
      ]);
      r.font = { name: FONT_NAME, size: 10 };
      r.eachCell((cell) => { cell.border = cellBorder(); });
      // Number formatting for value columns
      for (const col of [4, 5, 6, 7, 8, 9]) {
        const cell = r.getCell(col);
        if (typeof cell.value === 'number') cell.numFmt = brlFormat();
      }
      // Status color
      const bg = statusColors[m.matchStatus];
      if (bg) {
        r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      }
    }

    // Column widths
    wsCV.columns = [
      { width: 12 }, { width: 8 }, { width: 14 },
      { width: 16 }, { width: 16 }, { width: 12 },
      { width: 16 }, { width: 16 }, { width: 12 },
      { width: 25 },
    ];

    // Auto-filter on detail table
    if (cv.matches.length > 0) {
      wsCV.autoFilter = { from: `A${detailHeaderIdx}`, to: `J${detailHeaderIdx}` };
    }
  }

  // ============================================================
  // Generate and save
  // ============================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `auditoria-nfe-${formatDate()}.xlsx`);
}

// ============================================================
// Planilha 7.7 / 7.8 — Controle mensal SEFAZ (TTD 410)
// ============================================================

export interface Planilha77Options {
  /** AAAA-MM; filtra e nomeia o arquivo. Se omitido, usa todas as NFs do batch. */
  periodo?: string;
  /** Dados da contabilidade para aba opcional de confrontação. */
  contabilidade?: DadosContabilidade;
  confrontacao?: ConfrontacaoResult;
}

/**
 * Exporta planilhas 7.7 (Controle CP) e 7.8 (Fundos), obrigatórias no TTD 410.
 *
 * Abas:
 *  - 7.7 Controle CP: NF × alíquota × carga efetiva × CP × refTTD
 *  - 7.8 Fundos: NF × BC integral × fundos (0,4% flat)
 *  - Resumo Mensal: totais por cenário (DIME quadro 46)
 *  - Confrontação: apurado × contabilidade (apenas se `options.contabilidade` informado)
 */
export async function exportPlanilha77(
  results: NfeValidation[],
  regras: RegrasConfig,
  config: AppConfig,
  options: Planilha77Options = {},
): Promise<void> {
  const cenariosMap = getCenarios(regras);
  const apuracao = buildApuracaoMensal(results, regras, config, options.periodo);
  const periodoLabel = apuracao.periodo || formatDate();
  const taxaFundos = getTaxaFundos();

  const filtrado = options.periodo
    ? results.filter(nv => {
        const d = parseEmissionDate(nv.nfe.dhEmi);
        if (!d) return false;
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === options.periodo;
      })
    : results;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ICMS Auditor';
  wb.created = new Date();

  // ============================================================
  // Aba 1: 7.7 Controle CP
  // ============================================================
  const ws77 = wb.addWorksheet('7.7 Controle CP');
  ws77.columns = [
    { header: 'NF-e', key: 'nfe', width: 12 },
    { header: 'Serie', key: 'serie', width: 8 },
    { header: 'Data Emissao', key: 'dhEmi', width: 14 },
    { header: 'Item', key: 'nItem', width: 6 },
    { header: 'NCM', key: 'ncm', width: 12 },
    { header: 'CFOP', key: 'cfop', width: 8 },
    { header: 'Cenario', key: 'cenario', width: 10 },
    { header: 'Ref TTD', key: 'refTTD', width: 18 },
    { header: 'Aliq. Destacada (%)', key: 'pICMS', width: 16 },
    { header: 'ICMS Recolher (%)', key: 'carga', width: 16 },
    { header: 'BC Integral (R$)', key: 'bc', width: 16 },
    { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
    { header: 'ICMS Recolher (R$)', key: 'icmsRecolher', width: 18 },
    { header: 'CP Codigo', key: 'cpCod', width: 14 },
    { header: 'CP % Declarado', key: 'pCP', width: 14 },
    { header: 'CP Valor (R$)', key: 'vCP', width: 16 },
  ];

  let linhas77 = 0;
  for (const nv of filtrado) {
    for (const iv of nv.itensValidados) {
      if (iv.cenario === 'DEVOLUCAO') continue;
      const cenario = cenariosMap[iv.cenario];
      const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      const cargaPct = getCargaEfetiva(iv, cenariosMap, config);
      const rowNum = linhas77 + 2; // header is row 1
      const row = ws77.addRow({
        nfe: nv.nfe.numero,
        serie: nv.nfe.serie,
        dhEmi: parseEmissionDate(nv.nfe.dhEmi),
        nItem: iv.item.nItem,
        ncm: iv.item.ncm,
        cfop: iv.item.cfop,
        cenario: iv.cenario,
        refTTD: cenario?.refTTD ?? '',
        pICMS: iv.item.pICMS,
        carga: cargaPct,
        bc,
        icmsDest: iv.item.vICMS,
        icmsRecolher: 0, // placeholder — formula abaixo
        cpCod: iv.item.cCredPresumido,
        pCP: iv.item.pCredPresumido,
        vCP: iv.item.vCredPresumido,
      });
      // ICMS Recolher (col M) = BC Integral (col K) × ICMS Recolher % (col J) / 100
      row.getCell('icmsRecolher').value = { formula: `K${rowNum}*J${rowNum}/100` };
      ['bc', 'icmsDest', 'icmsRecolher', 'vCP'].forEach(k => {
        row.getCell(k).numFmt = brlFormat();
      });
      ['pICMS', 'carga', 'pCP'].forEach(k => {
        row.getCell(k).numFmt = pctFormat();
      });
      row.getCell('dhEmi').numFmt = 'DD/MM/YYYY';
      linhas77++;
    }
  }
  applyHeaderRow(ws77);
  if (linhas77 > 0) {
    applyDataRows(ws77, 2, linhas77 + 1);
    // Total
    const totalRowNum = linhas77 + 2;
    const totalRow = ws77.getRow(totalRowNum);
    totalRow.getCell('nfe').value = 'TOTAL';
    totalRow.getCell('bc').value = { formula: `SUM(K2:K${linhas77 + 1})` };
    totalRow.getCell('icmsDest').value = { formula: `SUM(L2:L${linhas77 + 1})` };
    totalRow.getCell('icmsRecolher').value = { formula: `SUM(M2:M${linhas77 + 1})` };
    totalRow.getCell('vCP').value = { formula: `SUM(P2:P${linhas77 + 1})` };
    ['bc', 'icmsDest', 'icmsRecolher', 'vCP'].forEach(k => {
      totalRow.getCell(k).numFmt = brlFormat();
    });
    applyTotalRow(ws77, totalRowNum, ws77.columnCount);
    ws77.autoFilter = { from: 'A1', to: `P${linhas77 + 1}` };
  }

  // ============================================================
  // Aba 2: 7.8 Fundos
  // ============================================================
  const ws78 = wb.addWorksheet('7.8 Fundos');
  ws78.columns = [
    { header: 'NF-e', key: 'nfe', width: 12 },
    { header: 'Serie', key: 'serie', width: 8 },
    { header: 'Data Emissao', key: 'dhEmi', width: 14 },
    { header: 'Item', key: 'nItem', width: 6 },
    { header: 'NCM', key: 'ncm', width: 12 },
    { header: 'Cenario', key: 'cenario', width: 10 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'BC Integral (R$)', key: 'bc', width: 16 },
    { header: `Taxa Fundos (%)`, key: 'taxa', width: 14 },
    { header: 'Fundos Devidos (R$)', key: 'fundos', width: 18 },
  ];

  let linhas78 = 0;
  for (const nv of filtrado) {
    for (const iv of nv.itensValidados) {
      const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      const cenario = cenariosMap[iv.cenario];
      // Devoluções: crédito a estornar (valor negativo)
      const ehDevolucao = iv.cenario === 'DEVOLUCAO';
      const taxa = cenario ? cenario.fundos : taxaFundos;
      if (taxa <= 0 && !ehDevolucao) continue;
      const valorTaxa = ehDevolucao ? taxaFundos : taxa;
      const rowNum = linhas78 + 2; // header is row 1
      const row = ws78.addRow({
        nfe: nv.nfe.numero,
        serie: nv.nfe.serie,
        dhEmi: parseEmissionDate(nv.nfe.dhEmi),
        nItem: iv.item.nItem,
        ncm: iv.item.ncm,
        cenario: iv.cenario,
        tipo: ehDevolucao ? 'Devolucao' : 'Saida',
        bc,
        taxa: valorTaxa,
        fundos: 0, // placeholder — formula abaixo
      });
      // Fundos Devidos (col J) = BC Integral (col H) × Taxa Fundos (col I) / 100
      // Devoluções: sinal negativo para indicar crédito a estornar
      const sinal = ehDevolucao ? '-' : '';
      row.getCell('fundos').value = { formula: `${sinal}H${rowNum}*I${rowNum}/100` };
      ['bc', 'fundos'].forEach(k => { row.getCell(k).numFmt = brlFormat(); });
      row.getCell('taxa').numFmt = pctFormat();
      row.getCell('dhEmi').numFmt = 'DD/MM/YYYY';
      linhas78++;
    }
  }
  applyHeaderRow(ws78);
  if (linhas78 > 0) {
    applyDataRows(ws78, 2, linhas78 + 1);
    const totalRowNum = linhas78 + 2;
    const totalRow = ws78.getRow(totalRowNum);
    totalRow.getCell('nfe').value = 'TOTAL';
    totalRow.getCell('bc').value = { formula: `SUM(H2:H${linhas78 + 1})` };
    totalRow.getCell('fundos').value = { formula: `SUM(J2:J${linhas78 + 1})` };
    ['bc', 'fundos'].forEach(k => { totalRow.getCell(k).numFmt = brlFormat(); });
    applyTotalRow(ws78, totalRowNum, ws78.columnCount);
    ws78.autoFilter = { from: 'A1', to: `J${linhas78 + 1}` };
  }

  // ============================================================
  // Aba 3: Resumo Mensal (por cenário)
  // ============================================================
  const wsResumo = wb.addWorksheet('Resumo Mensal');
  wsResumo.columns = [
    { header: 'Periodo', key: 'periodo', width: 12 },
    { header: 'Cenario', key: 'cenario', width: 10 },
    { header: 'Ref TTD', key: 'refTTD', width: 18 },
    { header: 'Descricao', key: 'descricao', width: 40 },
    { header: 'Qtd NFs', key: 'qtdNfes', width: 10 },
    { header: 'Qtd Itens', key: 'qtdItens', width: 10 },
    { header: 'BC Total (R$)', key: 'totalBC', width: 18 },
    { header: 'ICMS Destacado (R$)', key: 'icmsDest', width: 18 },
    { header: 'Carga (%)', key: 'carga', width: 10 },
    { header: 'ICMS Recolher (R$)', key: 'icmsRecolher', width: 18 },
    { header: 'CP Apropriado (R$)', key: 'cp', width: 18 },
    { header: 'Fundos (R$)', key: 'fundos', width: 14 },
  ];

  apuracao.porCenario.forEach(c => {
    const row = wsResumo.addRow({
      periodo: apuracao.periodo,
      cenario: c.cenarioId,
      refTTD: c.refTTD,
      descricao: c.descricao,
      qtdNfes: c.qtdNfes,
      qtdItens: c.qtdItens,
      totalBC: c.totalBC,
      icmsDest: c.totalICMSDestacado,
      carga: c.cargaEfetiva,
      icmsRecolher: c.totalICMSRecolher,
      cp: c.totalCPApropriado,
      fundos: c.totalFundos,
    });
    ['totalBC', 'icmsDest', 'icmsRecolher', 'cp', 'fundos'].forEach(k => {
      row.getCell(k).numFmt = brlFormat();
    });
    row.getCell('carga').numFmt = pctFormat();
  });

  applyHeaderRow(wsResumo);
  if (apuracao.porCenario.length > 0) {
    applyDataRows(wsResumo, 2, apuracao.porCenario.length + 1);

    // Linhas de resumo consolidado abaixo da tabela
    const baseRow = apuracao.porCenario.length + 3;
    const rotulos: Array<[string, number]> = [
      ['Total BC Saidas', apuracao.totalBCSaidas],
      ['Total ICMS Destacado', apuracao.totalICMSDestacado],
      ['Total ICMS a Recolher', apuracao.totalICMSRecolher],
      ['Total CP Apropriado', apuracao.totalCPApropriado],
      ['Total Fundos', apuracao.totalFundos],
      ['Total Recolher + Fundos', apuracao.totalRecolherComFundos],
      ['BC Devoluções', apuracao.totalBCDevolucoes],
      ['CP Estornado (devol.)', apuracao.totalCPEstornado],
      ['Fundos Crédito (devol.)', apuracao.totalFundosCredito],
      ['Líquido ICMS', apuracao.liquidoICMSRecolher],
      ['Líquido Fundos', apuracao.liquidoFundos],
      ['Líquido Total', apuracao.liquidoTotal],
    ];
    rotulos.forEach(([label, val], idx) => {
      const r = wsResumo.getRow(baseRow + idx);
      r.getCell(1).value = label;
      r.getCell(1).font = { name: FONT_NAME, bold: true };
      r.getCell(2).value = val;
      r.getCell(2).numFmt = brlFormat();
    });
  }

  // ============================================================
  // Aba 4: Confrontação (opcional)
  // ============================================================
  if (options.contabilidade && options.confrontacao) {
    const wsConf = wb.addWorksheet('Confrontacao');
    wsConf.columns = [
      { header: 'Rubrica', key: 'rubrica', width: 24 },
      { header: 'Apurado Sistema (R$)', key: 'sistema', width: 22 },
      { header: 'Contabilidade (R$)', key: 'contab', width: 20 },
      { header: 'Diferenca (R$)', key: 'diff', width: 18 },
    ];
    const icmsContab = options.contabilidade.icmsDebitado - options.contabilidade.icmsCreditado;
    const linhas: Array<[string, number, number, number]> = [
      ['ICMS (liquido)', apuracao.liquidoICMSRecolher, icmsContab, options.confrontacao.diffICMS],
      ['Credito Presumido', apuracao.totalCPApropriado, options.contabilidade.cpApropriado, options.confrontacao.diffCP],
      ['Fundos', apuracao.liquidoFundos, options.contabilidade.fundosRecolhidos, options.confrontacao.diffFundos],
    ];
    linhas.forEach(([rubrica, sistema, contab, diff]) => {
      const row = wsConf.addRow({ rubrica, sistema, contab, diff });
      ['sistema', 'contab', 'diff'].forEach(k => { row.getCell(k).numFmt = brlFormat(); });
    });
    // Linha de status
    const statusRow = wsConf.addRow({ rubrica: `Status: ${options.confrontacao.status.toUpperCase()}` });
    statusRow.getCell(1).font = { name: FONT_NAME, bold: true };
    const statusBg =
      options.confrontacao.status === 'ok' ? COLORS.okBg :
      options.confrontacao.status === 'atencao' ? COLORS.warnBg :
      COLORS.errorBg;
    statusRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };

    options.confrontacao.observacoes.forEach(obs => {
      wsConf.addRow({ rubrica: obs });
    });

    applyHeaderRow(wsConf);
    applyDataRows(wsConf, 2, 4);
  }

  // ============================================================
  // Save
  // ============================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `planilha-77-78-${periodoLabel}.xlsx`);
}

// ============================================================================
// EXPORT: APURACAO TTD — espelha o relatorio da contabilidade (PDF)
// ============================================================================

import type {
  ApuracaoTTDResult,
  ApuracaoCargaBlock,
  ApuracaoOperacaoBlock,
  ApuracaoSubgrupo,
  ApuracaoLinha,
} from '../engine/apuracaoTTD.ts';

const TTD_NUM_COLS = 9; // Data, Documento, ValContabil, BC, Aliq, vICMS, CP, ICMSRecolher%, ICMSRecolher$

interface TTDRowContext {
  ws: ExcelJS.Worksheet;
  cursor: { row: number };
}

function ttdAddTitleRow(ctx: TTDRowContext, label: string): void {
  const { ws, cursor } = ctx;
  const row = ws.getRow(cursor.row);
  ws.mergeCells(cursor.row, 1, cursor.row, TTD_NUM_COLS);
  row.getCell(1).value = label;
  row.getCell(1).font = {
    name: FONT_NAME, size: 13, bold: true, color: { argb: COLORS.headerFont },
  };
  row.getCell(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg },
  };
  row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 24;
  cursor.row++;
}

function ttdAddCargaHeader(ctx: TTDRowContext, carga: ApuracaoCargaBlock): void {
  const { ws, cursor } = ctx;
  ws.mergeCells(cursor.row, 1, cursor.row, TTD_NUM_COLS);
  const row = ws.getRow(cursor.row);
  const camexTag = carga.isCAMEX ? '[CAMEX] ' : '';
  row.getCell(1).value =
    `${camexTag}Carga ${carga.carga.toFixed(2).replace('.', ',')}% — ${carga.aliquotaLabel}  (${carga.refTTDLabel})`;
  row.getCell(1).font = {
    name: FONT_NAME, size: 11, bold: true, color: { argb: COLORS.subHeaderFont },
  };
  // Diferencia visualmente blocos CAMEX (tom mais quente) dos blocos comuns
  row.getCell(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: carga.isCAMEX ? 'C77700' : COLORS.subHeaderBg },
  };
  row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  row.height = 20;
  cursor.row++;
}

function ttdAddOperacaoHeader(ctx: TTDRowContext, op: ApuracaoOperacaoBlock, cargaLabel: string): void {
  const { ws, cursor } = ctx;
  ws.mergeCells(cursor.row, 1, cursor.row, TTD_NUM_COLS);
  const row = ws.getRow(cursor.row);
  const tipoLabel = op.tipo === 'interna' ? 'Operacao Interna' : 'Operacao Interestadual';
  row.getCell(1).value = `${tipoLabel}: ${cargaLabel}`;
  row.getCell(1).font = { name: FONT_NAME, size: 10, bold: true };
  row.getCell(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg },
  };
  row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
  row.height = 18;
  cursor.row++;
}

function ttdAddSubgrupoLabel(ctx: TTDRowContext, sg: ApuracaoSubgrupo): void {
  const { ws, cursor } = ctx;
  ws.mergeCells(cursor.row, 1, cursor.row, TTD_NUM_COLS);
  const row = ws.getRow(cursor.row);
  row.getCell(1).value = sg.reducaoBC === 'sem_reducao' ? 'Sem reducao de BC' : 'Com reducao de BC';
  row.getCell(1).font = { name: FONT_NAME, size: 9, italic: true, color: { argb: '555555' } };
  row.getCell(1).alignment = { horizontal: 'left', indent: 3 };
  row.height = 16;
  cursor.row++;
}

function ttdAddTableHeader(ctx: TTDRowContext): void {
  const { ws, cursor } = ctx;
  const headers = ['Data', 'Documento', 'Valor Contabil', 'Base de Calculo', 'Aliquota', 'Valor ICMS', 'Cred. Presumido', 'ICMS Recolher %', 'ICMS Recolher'];
  const row = ws.getRow(cursor.row);
  headers.forEach((h, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = h;
    Object.assign(cell, { style: headerStyle() });
  });
  row.height = 24;
  cursor.row++;
}

function ttdAddDataRow(ctx: TTDRowContext, linha: ApuracaoLinha, alt: boolean): void {
  const { ws, cursor } = ctx;
  const r = cursor.row;
  const row = ws.getRow(r);
  row.getCell(1).value = linha.data;
  row.getCell(2).value = linha.numero;
  row.getCell(3).value = linha.valorContabil;
  row.getCell(4).value = linha.bcIntegral;
  row.getCell(5).value = linha.pICMS / 100;
  row.getCell(6).value = linha.vICMS;
  row.getCell(7).value = linha.vCP;
  // Col H: ICMS Recolher % (carga efetiva como decimal, ex: 0.01 para 1%)
  row.getCell(8).value = linha.cargaEfetiva / 100;
  // Col I: ICMS Recolher (R$) = BC (col D) × carga% (col H) — fórmula
  row.getCell(9).value = { formula: `D${r}*H${r}` };

  for (let c = 1; c <= TTD_NUM_COLS; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT_NAME, size: 10 };
    cell.border = cellBorder();
    cell.alignment = { vertical: 'middle' };
    if (alt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRowBg } };
    }
  }
  row.getCell(3).numFmt = brlFormat();
  row.getCell(4).numFmt = brlFormat();
  row.getCell(5).numFmt = '0.00%';
  row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(6).numFmt = brlFormat();
  row.getCell(7).numFmt = brlFormat();
  row.getCell(8).numFmt = '0.00%';
  row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(9).numFmt = brlFormat();

  // Marca itens com observacao "tem itens em outras cargas" como amarelo claro
  if (linha.temItensOutrasCargas) {
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warnBg } };
    row.getCell(2).note = 'Esta NF possui itens em outras cargas efetivas';
  }

  row.height = 17;
  cursor.row++;
}

function ttdAddSubtotalRow(ctx: TTDRowContext, label: string, sg: ApuracaoSubgrupo | ApuracaoOperacaoBlock | ApuracaoCargaBlock, dataStartRow?: number, dataEndRow?: number): void {
  const { ws, cursor } = ctx;
  const row = ws.getRow(cursor.row);
  row.getCell(1).value = label;
  row.getCell(2).value = '';
  row.getCell(3).value = '';
  row.getCell(4).value = sg.totalBC;
  row.getCell(5).value = '';
  row.getCell(6).value = sg.totalVICMS;
  row.getCell(7).value = sg.totalCP;
  row.getCell(8).value = '';
  // Col I subtotal: soma das fórmulas de ICMS Recolher, se range disponível
  if (dataStartRow !== undefined && dataEndRow !== undefined && dataEndRow >= dataStartRow) {
    row.getCell(9).value = { formula: `SUM(I${dataStartRow}:I${dataEndRow})` };
  } else {
    row.getCell(9).value = '';
  }

  for (let c = 1; c <= TTD_NUM_COLS; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT_NAME, size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
    cell.border = cellBorder();
    cell.alignment = { vertical: 'middle' };
  }
  row.getCell(4).numFmt = brlFormat();
  row.getCell(6).numFmt = brlFormat();
  row.getCell(7).numFmt = brlFormat();
  row.getCell(9).numFmt = brlFormat();
  row.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  row.height = 18;
  cursor.row++;
}

/** Subtotal que soma linhas de subtotais anteriores (evita duplicação de range contínuo) */
function ttdAddSumOfSubtotalsRow(
  ctx: TTDRowContext,
  label: string,
  block: ApuracaoSubgrupo | ApuracaoOperacaoBlock | ApuracaoCargaBlock,
  subtotalRows: number[],
): void {
  const { ws, cursor } = ctx;
  const row = ws.getRow(cursor.row);
  row.getCell(1).value = label;
  row.getCell(2).value = '';
  row.getCell(3).value = '';
  row.getCell(4).value = block.totalBC;
  row.getCell(5).value = '';
  row.getCell(6).value = block.totalVICMS;
  row.getCell(7).value = block.totalCP;
  row.getCell(8).value = '';
  // Col I: soma pontual das linhas de subtotal (I5+I12+... em vez de SUM(I5:I12))
  if (subtotalRows.length > 0) {
    const refs = subtotalRows.map(r => `I${r}`).join('+');
    row.getCell(9).value = { formula: refs };
  } else {
    row.getCell(9).value = '';
  }

  for (let c = 1; c <= TTD_NUM_COLS; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT_NAME, size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
    cell.border = cellBorder();
    cell.alignment = { vertical: 'middle' };
  }
  row.getCell(4).numFmt = brlFormat();
  row.getCell(6).numFmt = brlFormat();
  row.getCell(7).numFmt = brlFormat();
  row.getCell(9).numFmt = brlFormat();
  row.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  row.height = 18;
  cursor.row++;
}

function ttdAddBlankRow(ctx: TTDRowContext): void {
  ctx.cursor.row++;
}

/**
 * Exporta a Apuracao TTD para Excel, espelhando a estrutura visual do
 * "Relatorio da Apuracao dos Creditos por Regime Especial" emitido pela
 * contabilidade.
 *
 * Layout: aba unica "Apuracao TTD" com:
 *  - Cabecalho com periodo
 *  - Para cada carga (1,00 / 2,10 / 3,60): subheader + (operacao interna /
 *    interestadual) × (sem reducao / com reducao) × linhas NF×aliquota
 *  - Subtotais por subgrupo, operacao e carga
 *  - Bloco "Debitos" agregando vICMS por carga
 *  - Bloco "Fundos" com FUNDEC, FUMDES, Pro-Emprego, Fundo Social
 */
export async function exportApuracaoTTD(apuracao: ApuracaoTTDResult): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ICMS Auditor';
  wb.created = new Date();

  const ws = wb.addWorksheet('Apuracao TTD');
  ws.columns = [
    { width: 12 },  // A: Data
    { width: 15 },  // B: Documento
    { width: 18 },  // C: Valor Contabil
    { width: 18 },  // D: Base de Calculo
    { width: 12 },  // E: Aliquota
    { width: 18 },  // F: Valor ICMS
    { width: 18 },  // G: Cred. Presumido
    { width: 16 },  // H: ICMS Recolher %
    { width: 18 },  // I: ICMS Recolher R$
  ];

  const ctx: TTDRowContext = { ws, cursor: { row: 1 } };

  // Titulo
  const periodoLabel = apuracao.periodo
    ? `Competencia ${apuracao.periodo}`
    : 'Competencia nao identificada';
  ttdAddTitleRow(ctx, `APURACAO TTD 410 — ${periodoLabel}`);
  ttdAddBlankRow(ctx);

  // Cargas
  for (const carga of apuracao.cargas) {
    if (carga.totalBC === 0) continue;

    ttdAddCargaHeader(ctx, carga);

    const cargaLabelNum = carga.carga.toFixed(2).replace('.', ',');
    let altCounter = 0;
    // Rastrear linhas de subtotal de operação para o SUM do total de carga
    const opSubtotalRows: number[] = [];

    for (const op of carga.operacoes) {
      ttdAddOperacaoHeader(ctx, op, cargaLabelNum);
      // Rastrear linhas de subtotal de subgrupo para o SUM da operação
      const sgSubtotalRows: number[] = [];

      for (const sg of op.subgrupos) {
        ttdAddSubgrupoLabel(ctx, sg);
        ttdAddTableHeader(ctx);
        const sgStartRow = ctx.cursor.row;
        for (const linha of sg.linhas) {
          ttdAddDataRow(ctx, linha, altCounter % 2 === 1);
          altCounter++;
        }
        const sgEndRow = ctx.cursor.row - 1;
        // Subtotal do subgrupo: SUM dos dados do subgrupo (sem sobreposição)
        ttdAddSubtotalRow(ctx, `${sg.reducaoBC === 'sem_reducao' ? 'sem reducao' : 'com reducao de BC'}`, sg, sgStartRow, sgEndRow);
        sgSubtotalRows.push(ctx.cursor.row - 1); // registra a linha do subtotal
      }

      // Total operação: soma os subtotais dos subgrupos (não o range inteiro)
      ttdAddSumOfSubtotalsRow(ctx, `${op.tipo === 'interna' ? 'racao Interna' : 'Interestadual'}`, op, sgSubtotalRows);
      opSubtotalRows.push(ctx.cursor.row - 1); // registra a linha do total operação
    }

    // TOTAL CARGA: soma os totais de operação (não o range inteiro)
    ttdAddSumOfSubtotalsRow(ctx, `CARGA ${cargaLabelNum}%`, carga, opSubtotalRows);
    ttdAddBlankRow(ctx);
  }

  // Debitos
  ttdAddBlankRow(ctx);
  ttdAddTitleRow(ctx, 'DEBITOS COM BENEFICIO FISCAL');
  {
    const headers = ['Carga / Aliquota', '', '', '', 'ICMS Destacado', 'ICMS a Recolher', ''];
    const row = ws.getRow(ctx.cursor.row);
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = h;
      if (h) Object.assign(cell, { style: headerStyle() });
    });
    row.height = 22;
    ctx.cursor.row++;
  }
  let totalRecolherDebitos = 0;
  for (const c of apuracao.cargas) {
    if (c.totalVICMS === 0) continue;
    const recolher = Math.round(c.totalBC * c.carga) / 100;
    totalRecolherDebitos += recolher;
    const row = ws.getRow(ctx.cursor.row);
    ws.mergeCells(ctx.cursor.row, 1, ctx.cursor.row, 4);
    const camexTag = c.isCAMEX ? '[CAMEX] ' : '';
    row.getCell(1).value = `${camexTag}Carga ${c.carga.toFixed(2).replace('.', ',')}% — ${c.aliquotaLabel}`;
    row.getCell(5).value = c.totalVICMS;
    row.getCell(5).numFmt = brlFormat();
    row.getCell(6).value = recolher;
    row.getCell(6).numFmt = brlFormat();
    for (let cc = 1; cc <= TTD_NUM_COLS; cc++) {
      const cell = row.getCell(cc);
      cell.font = { name: FONT_NAME, size: 10 };
      cell.border = cellBorder();
      cell.alignment = { vertical: 'middle', horizontal: cc >= 5 ? 'right' : 'left', indent: 1 };
    }
    row.height = 18;
    ctx.cursor.row++;
  }
  {
    const row = ws.getRow(ctx.cursor.row);
    ws.mergeCells(ctx.cursor.row, 1, ctx.cursor.row, 4);
    row.getCell(1).value = 'TOTAL DEBITOS COM BENEFICIO';
    row.getCell(5).value = apuracao.totalVICMSGlobal;
    row.getCell(5).numFmt = brlFormat();
    row.getCell(6).value = Math.round(totalRecolherDebitos * 100) / 100;
    row.getCell(6).numFmt = brlFormat();
    for (let cc = 1; cc <= TTD_NUM_COLS; cc++) {
      const cell = row.getCell(cc);
      cell.font = { name: FONT_NAME, size: 11, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = cellBorder();
      cell.alignment = { vertical: 'middle', horizontal: cc >= 5 ? 'right' : 'left', indent: 1 };
    }
    row.height = 22;
    ctx.cursor.row++;
  }

  // Fundos
  ttdAddBlankRow(ctx);
  ttdAddTitleRow(ctx, 'FUNDOS SOCIAIS');

  // Linha de referência: BC integral total e CP total em células acessíveis por fórmula
  {
    const row = ws.getRow(ctx.cursor.row);
    ws.mergeCells(ctx.cursor.row, 1, ctx.cursor.row, 3);
    row.getCell(1).value = 'BC integral total';
    row.getCell(4).value = apuracao.totalBCGlobal;
    row.getCell(4).numFmt = brlFormat();
    ws.mergeCells(ctx.cursor.row, 5, ctx.cursor.row, 5);
    row.getCell(5).value = 'CP total';
    row.getCell(6).value = apuracao.totalCPGlobal;
    row.getCell(6).numFmt = brlFormat();
    for (let cc = 1; cc <= TTD_NUM_COLS; cc++) {
      const cell = row.getCell(cc);
      cell.font = { name: FONT_NAME, size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = cellBorder();
      cell.alignment = { vertical: 'middle', horizontal: cc >= 4 ? 'right' : 'left', indent: 1 };
    }
    row.height = 20;
  }
  const refRow = ctx.cursor.row; // D{refRow} = BC total, F{refRow} = CP total
  ctx.cursor.row++;

  {
    const headers = ['Fundo', '', 'Memoria de calculo', '', '', 'Valor', '', '', ''];
    const row = ws.getRow(ctx.cursor.row);
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = h;
      if (h) Object.assign(cell, { style: headerStyle() });
    });
    row.height = 22;
    ctx.cursor.row++;
  }

  // Helper para escrever uma linha de fundo
  const addFundoRow = (nome: string, memoria: string, valor: { formula: string } | number | string) => {
    const row = ws.getRow(ctx.cursor.row);
    ws.mergeCells(ctx.cursor.row, 1, ctx.cursor.row, 2);
    ws.mergeCells(ctx.cursor.row, 3, ctx.cursor.row, 5);
    row.getCell(1).value = nome;
    row.getCell(3).value = memoria;
    row.getCell(6).value = valor;
    row.getCell(6).numFmt = brlFormat();
    for (let cc = 1; cc <= TTD_NUM_COLS; cc++) {
      const cell = row.getCell(cc);
      cell.font = { name: FONT_NAME, size: 10 };
      cell.border = cellBorder();
      cell.alignment = { vertical: 'middle', horizontal: cc === 6 ? 'right' : 'left', indent: 1 };
    }
    row.height = 18;
    const thisRow = ctx.cursor.row;
    ctx.cursor.row++;
    return thisRow;
  };

  // FUNDEC — isento, valor em branco
  addFundoRow('FUNDEC', '0,05% × BC integral (isento)', '');
  // FUMDES
  const fumdesRow = addFundoRow('FUMDES', '2,00% × CP total', { formula: `F${refRow}*2/100` });
  // Pro-Emprego
  addFundoRow('Pro-Emprego', '2,50% × BC − deducoes', 0);
  // Fundo Social = max(0, 0,40% × BC − FUMDES)
  const fundoSocialRow = addFundoRow('Fundo Social', '0,40% × BC − FUMDES', { formula: `MAX(0,D${refRow}*0.4/100-F${fumdesRow})` });

  // TOTAL FUNDOS = FUMDES + Fundo Social
  {
    const row = ws.getRow(ctx.cursor.row);
    ws.mergeCells(ctx.cursor.row, 1, ctx.cursor.row, 5);
    row.getCell(1).value = 'TOTAL FUNDOS';
    row.getCell(6).value = { formula: `F${fumdesRow}+F${fundoSocialRow}` };
    row.getCell(6).numFmt = brlFormat();
    for (let cc = 1; cc <= TTD_NUM_COLS; cc++) {
      const cell = row.getCell(cc);
      cell.font = { name: FONT_NAME, size: 11, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = cellBorder();
      cell.alignment = { vertical: 'middle', horizontal: cc === 6 ? 'right' : 'left', indent: 1 };
    }
    row.height = 22;
    ctx.cursor.row++;
  }

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `apuracao-ttd-${apuracao.periodo || formatDate()}.xlsx`;
  saveAs(blob, fileName);
}

