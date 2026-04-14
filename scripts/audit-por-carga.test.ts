import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseNfe } from '../src/engine/parser.ts';
import { makeConfig } from '../src/engine/__tests__/fixtures.ts';
import { getDefaultRegras } from '../src/data/defaultRegras.ts';
import { detectarCanceladas, filtrarNfes } from '../src/engine/nfeFilters.ts';
import { bcIntegral } from '../src/utils/formatters.ts';
import type { NfeData } from '../src/types/nfe.ts';

const XML_DIR = 'C:\\Users\\maico\\Downloads\\2026-03 - PRIME MATRIZ - XMLS';

const CONTABIL_GRUPOS = [
  { carga: '1,00%', bc: 17_072_764.40, icms: 682_910.63, cp: 512_182.92 },
  { carga: '2,10%', bc: 8_496_130.66, icms: 967_533.02, cp: 789_114.31 },
  { carga: '3,60%', bc: 56_959_886.61, icms: 5_821_492.11, cp: 3_770_935.90 },
];

describe('Breakdown por carga efetiva', () => {
  it('agrupa por carga e compara com contabil', () => {
    const allFiles = fs.readdirSync(XML_DIR).filter(f => f.endsWith('.xml'));
    const canceladas = detectarCanceladas(allFiles);
    const parsedNfes: NfeData[] = [];
    for (const file of allFiles) {
      const xml = fs.readFileSync(path.join(XML_DIR, file), 'utf-8');
      const parsed = parseNfe(xml, file);
      if (parsed.success) parsedNfes.push(parsed.data);
    }
    const { accepted } = filtrarNfes(parsedNfes, canceladas);
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Agrupar itens por carga efetiva (como a contabilidade faz: por item, nao por NF)
    // Regra TTD 409: 4% → 1,00% | 12% puro (grupo 2,10) | 10/12/17% → 3,60%
    // A contabilidade separa o grupo 2,10% como NFs INTEIRAS a 12% (sem mix)
    // O grupo 3,60% inclui itens a 10%, 12% (em NFs mistas), e 17%
    const grupos = new Map<string, { bc: number; icms: number; cp: number; qtd: number }>();

    // Coletar os numeros de NF que estao no grupo 2,10% do contabil
    const NFS_GRUPO_210 = new Set(['47657','47677','47729','47732','47888','47979','48007','48060','48180']);

    for (const nfe of accepted) {
      for (const item of nfe.itens) {
        if (item.vICMS === 0) continue; // pular itens sem ICMS (CFOP 3949 etc)
        const bc = bcIntegral(item.vBC, item.pRedBC);

        let carga: string;
        if (Math.abs(item.pICMS - 4) < 0.01) {
          carga = '1,00%';
        } else if (Math.abs(item.pICMS - 12) < 0.01 && NFS_GRUPO_210.has(nfe.numero)) {
          carga = '2,10%';
        } else {
          carga = '3,60%';
        }

        if (!grupos.has(carga)) grupos.set(carga, { bc: 0, icms: 0, cp: 0, qtd: 0 });
        const g = grupos.get(carga)!;
        g.bc += bc;
        g.icms += item.vICMS;
        g.qtd++;
        // CP = ICMS - recolher. Recolher = bc × carga/100
        const cargaPct = carga === '1,00%' ? 1.0 : carga === '2,10%' ? 2.1 : 3.6;
        g.cp += item.vICMS - bc * (cargaPct / 100);
      }
    }

    console.log('\n--- BREAKDOWN POR CARGA EFETIVA (após filtros) ---');
    console.log(`${'Carga'.padEnd(8)} ${'Itens'.padStart(6)} ${'BC Sistema'.padStart(18)} ${'BC Contábil'.padStart(18)} ${'Diff'.padStart(12)} ${'ICMS Sist'.padStart(16)} ${'ICMS Cont'.padStart(16)} ${'Diff'.padStart(12)}`);
    for (const c of CONTABIL_GRUPOS) {
      const g = grupos.get(c.carga);
      if (g) {
        const bcDiff = g.bc - c.bc;
        const icmsDiff = g.icms - c.icms;
        console.log(
          `${c.carga.padEnd(8)} ${String(g.qtd).padStart(6)} ${fmt(g.bc).padStart(18)} ${fmt(c.bc).padStart(18)} ${fmt(bcDiff).padStart(12)} ${fmt(g.icms).padStart(16)} ${fmt(c.icms).padStart(16)} ${fmt(icmsDiff).padStart(12)}`
        );
      }
    }

    // Totais
    let totalBCSist = 0, totalBCCont = 0, totalICMSSist = 0, totalICMSCont = 0;
    for (const c of CONTABIL_GRUPOS) {
      const g = grupos.get(c.carga);
      if (g) { totalBCSist += g.bc; totalICMSSist += g.icms; }
      totalBCCont += c.bc;
      totalICMSCont += c.icms;
    }
    console.log(`${'TOTAL'.padEnd(8)} ${''.padStart(6)} ${fmt(totalBCSist).padStart(18)} ${fmt(totalBCCont).padStart(18)} ${fmt(totalBCSist - totalBCCont).padStart(12)} ${fmt(totalICMSSist).padStart(16)} ${fmt(totalICMSCont).padStart(16)} ${fmt(totalICMSSist - totalICMSCont).padStart(12)}`);
  });
});
