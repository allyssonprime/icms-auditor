import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseNfe } from '../src/engine/parser.ts';

const XML_DIR = 'C:\\Users\\maico\\Downloads\\2026-03 - PRIME MATRIZ - XMLS';

describe('Check refNFe', () => {
  it('lista todas as NFs com refNFe e as NFs referenciadas', () => {
    const allFiles = fs.readdirSync(XML_DIR).filter(f => f.endsWith('.xml'));

    console.log('\n--- TODAS AS NFs COM refNFe ---');
    for (const file of allFiles) {
      const xml = fs.readFileSync(path.join(XML_DIR, file), 'utf-8');
      const parsed = parseNfe(xml, file);
      if (!parsed.success) continue;
      const nfe = parsed.data;
      if (nfe.refNFe.length > 0) {
        for (const ref of nfe.refNFe) {
          // Extrair numero da NF da chave (pos 25-34, 0-indexed)
          const refNumero = String(parseInt(ref.substring(25, 34), 10));
          console.log(`NF ${nfe.numero} (serie ${nfe.serie}) → referencia NF ${refNumero} (chave ${ref})`);
        }
      }
    }

    // Agora verificar quais das 3 NFs problematicas (47685, 47803, 48005) tem TTD
    console.log('\n--- NFs 47685, 47803, 48005 — detalhes ---');
    for (const file of allFiles) {
      const xml = fs.readFileSync(path.join(XML_DIR, file), 'utf-8');
      const parsed = parseNfe(xml, file);
      if (!parsed.success) continue;
      if (['47685','47803','48005'].includes(parsed.data.numero)) {
        const nfe = parsed.data;
        const totalICMS = nfe.itens.reduce((s, i) => s + i.vICMS, 0);
        console.log(`NF ${nfe.numero} serie=${nfe.serie} ICMS=${totalICMS.toFixed(2)} TTD=${/ttd/i.test(nfe.infCpl)} refs=${nfe.refNFe.length}`);
        console.log(`  infCpl: ${nfe.infCpl.substring(0, 100)}`);
      }
    }
  });
});
