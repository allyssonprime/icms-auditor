/**
 * Script de auditoria — Prime Internacional 03/2026
 *
 * Roda o pipeline real do auditor (parseNfe + validarNfe) sobre todos os XMLs
 * APLICANDO OS 3 FILTROS (canceladas, sem TTD, estornos) e compara com os
 * totais contabeis do demonstrativo de CP TTD 409.
 *
 * Rodar: npx vitest run scripts/audit-prime-032026.test.ts
 */
import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseNfe } from '../src/engine/parser.ts';
import { validarNfe } from '../src/engine/validator.ts';
import { makeConfig } from '../src/engine/__tests__/fixtures.ts';
import { bcIntegral } from '../src/utils/formatters.ts';
import { deriveCargaEfetiva, calcularICMSRecolherItem } from '../src/engine/calculoHelpers.ts';
import { getCenarios } from '../src/engine/cenarios.ts';
import { isCobreAco } from '../src/data/cobreAco.ts';
import { getDefaultRegras } from '../src/data/defaultRegras.ts';
import { detectarCanceladas, filtrarNfes } from '../src/engine/nfeFilters.ts';
import type { NfeData } from '../src/types/nfe.ts';

const XML_DIR = 'C:\\Users\\maico\\Downloads\\2026-03 - PRIME MATRIZ - XMLS';

// --- Totais contabeis (Demonstrativo CP TTD 409 Prime 03/2026) ---
const CONTABIL = {
  grupos: [
    { nome: 'Op. Interna 1,00% (4%)', bc: 17_072_764.40, icms: 682_910.63, cp: 512_182.92 },
    { nome: 'Op. Interna 2,10% (12%)', bc: 8_496_130.66, icms: 967_533.02, cp: 789_114.31 },
    { nome: 'Op. Interna 3,60% (10/12/17%)', bc: 56_959_886.61, icms: 5_821_492.11, cp: 3_770_935.90 },
  ],
  bcBeneficio: 82_528_781.67,
  icmsBeneficio: 7_471_935.76,
  icmsSemBeneficio: 342_172.11,
  icmsDebitoTotal: 7_814_107.87,
  cpTotal: 5_072_233.13,
};

describe('Auditoria Prime 03/2026 — com filtros', () => {
  it('processa XMLs, aplica filtros, e compara com contabil', () => {
    const allFiles = fs.readdirSync(XML_DIR);
    const xmlFiles = allFiles.filter(f => f.endsWith('.xml'));
    console.log(`\n${'='.repeat(80)}`);
    console.log(`AUDITORIA PRIME 03/2026 — ${xmlFiles.length} arquivos XML`);
    console.log('='.repeat(80));

    const config = makeConfig();
    const regras = getDefaultRegras();
    const cenariosMap = getCenarios(regras);

    // FILTRO 1 — detectar canceladas pelo nome do arquivo
    const canceladas = detectarCanceladas(xmlFiles);
    console.log(`\nCanceladas detectadas pelo filename: ${canceladas.size}`);
    for (const c of canceladas) console.log(`  chave: ...${c.slice(-12)}`);

    // Parse de todos os XMLs (exceto canceladas no parse — vamos parsear e filtrar depois)
    let parseOk = 0;
    let parseErr = 0;
    const parsedNfes: NfeData[] = [];

    for (const file of xmlFiles) {
      const xml = fs.readFileSync(path.join(XML_DIR, file), 'utf-8');
      const parsed = parseNfe(xml, file);
      if (!parsed.success) {
        parseErr++;
        continue;
      }
      parseOk++;
      parsedNfes.push(parsed.data);
    }

    console.log(`Parse: ${parseOk} OK, ${parseErr} erro`);
    console.log(`NFs parseadas antes dos filtros: ${parsedNfes.length}`);

    // Aplicar os 3 filtros
    const { accepted, excluded, counts } = filtrarNfes(parsedNfes, canceladas);

    console.log(`\n--- FILTROS APLICADOS ---`);
    console.log(`Canceladas removidas: ${counts.canceladas}`);
    console.log(`Sem TTD removidas:    ${counts.semTtd}`);
    console.log(`Estornos removidos:   ${counts.estornoPar} (pares estorno+estornada)`);
    console.log(`Total excluidas:      ${excluded.length}`);
    console.log(`NFs aceitas:          ${accepted.length}`);

    // Detalhar excluidas
    for (const e of excluded) {
      console.log(`  [${e.reason.padEnd(10)}] NF ${e.nfe.numero} (serie ${e.nfe.serie}) chave ...${e.nfe.chaveAcesso.slice(-12)}`);
    }

    // Rodar pipeline sobre NFs aceitas
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pct = (got: number, want: number) => want === 0 ? '-' : `${((got / want - 1) * 100).toFixed(2)}%`;

    let totalBCIntegral = 0;
    let totalICMSDest = 0;
    let totalICMSRecolher = 0;
    let totalCPCalc = 0;
    let totalCPDecl = 0;
    let totalFundos = 0;
    let totalItens = 0;

    const porCenario = new Map<string, { qtd: number; bc: number; icms: number; recolher: number; cp: number }>();
    const porAliq = new Map<string, { qtd: number; bc: number; icms: number; recolher: number }>();
    const porCFOP = new Map<string, { qtd: number; bc: number; icms: number }>();

    for (const nfe of accepted) {
      const result = validarNfe(nfe, config, undefined, regras);
      for (const iv of result.itensValidados) {
        totalItens++;
        const cenId = iv.cenario || 'SEM_CENARIO';
        const cenario = cenariosMap[cenId];
        const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
        const isCA = isCobreAco(iv.item.ncm, config.listaCobreAco);
        const carga = cenario ? deriveCargaEfetiva(iv.item.pICMS, cenario, isCA) : 0;
        const recolher = cenario ? calcularICMSRecolherItem(iv.item, cenario, isCA) : 0;
        const fundos = cenario && cenario.fundos > 0 ? bc * (cenario.fundos / 100) : 0;
        const cpCalc = carga > 0 && iv.item.pICMS > carga ? bc * ((iv.item.pICMS - carga) / 100) : 0;

        totalBCIntegral += bc;
        totalICMSDest += iv.item.vICMS;
        totalICMSRecolher += recolher;
        totalCPCalc += cpCalc;
        totalCPDecl += iv.item.vCredPresumido || 0;
        totalFundos += fundos;

        // Por cenario
        if (!porCenario.has(cenId)) porCenario.set(cenId, { qtd: 0, bc: 0, icms: 0, recolher: 0, cp: 0 });
        const c = porCenario.get(cenId)!;
        c.qtd++; c.bc += bc; c.icms += iv.item.vICMS; c.recolher += recolher; c.cp += cpCalc;

        // Por aliquota
        const alKey = `${iv.item.pICMS}%`;
        if (!porAliq.has(alKey)) porAliq.set(alKey, { qtd: 0, bc: 0, icms: 0, recolher: 0 });
        const a = porAliq.get(alKey)!;
        a.qtd++; a.bc += bc; a.icms += iv.item.vICMS; a.recolher += recolher;

        // Por CFOP
        if (!porCFOP.has(iv.item.cfop)) porCFOP.set(iv.item.cfop, { qtd: 0, bc: 0, icms: 0 });
        const cf = porCFOP.get(iv.item.cfop)!;
        cf.qtd++; cf.bc += bc; cf.icms += iv.item.vICMS;
      }
    }

    console.log(`\n--- TOTAIS GERAIS (apos filtros) ---`);
    console.log(`                       Sistema         Contábil         Diff`);
    console.log(`BC Integral:     ${fmt(totalBCIntegral).padStart(18)}  ${fmt(CONTABIL.bcBeneficio).padStart(18)}  ${pct(totalBCIntegral, CONTABIL.bcBeneficio).padStart(8)}`);
    console.log(`ICMS Beneficio:  ${fmt(totalICMSDest).padStart(18)}  ${fmt(CONTABIL.icmsBeneficio).padStart(18)}  ${pct(totalICMSDest, CONTABIL.icmsBeneficio).padStart(8)}`);
    console.log(`ICMS Recolher:   ${fmt(totalICMSRecolher).padStart(18)}`);
    console.log(`CP Calculado:    ${fmt(totalCPCalc).padStart(18)}  ${fmt(CONTABIL.cpTotal).padStart(18)}  ${pct(totalCPCalc, CONTABIL.cpTotal).padStart(8)}`);
    console.log(`Fundos (0,4%):   ${fmt(totalFundos).padStart(18)}`);

    console.log(`\n--- POR CENÁRIO ---`);
    for (const [k, c] of [...porCenario.entries()].sort()) {
      console.log(`${k.padEnd(14)} ${String(c.qtd).padStart(6)} ${fmt(c.bc).padStart(18)} ${fmt(c.icms).padStart(18)} ${fmt(c.recolher).padStart(18)} ${fmt(c.cp).padStart(18)}`);
    }

    console.log(`\n--- POR ALÍQUOTA ---`);
    for (const [k, a] of [...porAliq.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
      console.log(`${k.padEnd(10)} ${String(a.qtd).padStart(6)} ${fmt(a.bc).padStart(18)} ${fmt(a.icms).padStart(18)} ${fmt(a.recolher).padStart(18)}`);
    }

    console.log(`\n--- POR CFOP ---`);
    for (const [k, cf] of [...porCFOP.entries()].sort()) {
      console.log(`${k.padEnd(8)} ${String(cf.qtd).padStart(6)} ${fmt(cf.bc).padStart(18)} ${fmt(cf.icms).padStart(18)}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('FIM DA AUDITORIA');
    console.log('='.repeat(80));
  });
});
