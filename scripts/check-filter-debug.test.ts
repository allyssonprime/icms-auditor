import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseNfe } from '../src/engine/parser.ts';
import { detectarCanceladas, filtrarNfes, hasTtdBeneficio } from '../src/engine/nfeFilters.ts';
import type { NfeData } from '../src/types/nfe.ts';

const XML_DIR = 'C:\\Users\\maico\\Downloads\\2026-03 - PRIME MATRIZ - XMLS';

describe('Debug filtro estornos', () => {
  it('rastreia NFs 47782/47685, 47917/47803, 48152/48005 nos filtros', () => {
    const allFiles = fs.readdirSync(XML_DIR).filter(f => f.endsWith('.xml'));
    const canceladas = detectarCanceladas(allFiles);

    const parsedNfes: NfeData[] = [];
    for (const file of allFiles) {
      const xml = fs.readFileSync(path.join(XML_DIR, file), 'utf-8');
      const parsed = parseNfe(xml, file);
      if (parsed.success) parsedNfes.push(parsed.data);
    }

    const TARGET = ['47685','47803','48005','47782','47917','48152'];

    // Verificar se as NFs alvo passam pelo filtro TTD
    console.log('\n--- Filtro TTD sobre NFs alvo ---');
    for (const nfe of parsedNfes) {
      if (TARGET.includes(nfe.numero)) {
        console.log(`NF ${nfe.numero} serie=${nfe.serie} hasTTD=${hasTtdBeneficio(nfe)} cancelada=${canceladas.has(nfe.chaveAcesso)} chave=${nfe.chaveAcesso}`);
      }
    }

    // Aplicar filtro sem TTD manualmente para ver quais sobrevivem
    const postCanceladas = parsedNfes.filter(n => !canceladas.has(n.chaveAcesso));
    const postTtd = postCanceladas.filter(n => hasTtdBeneficio(n));

    console.log('\n--- NFs alvo depois do filtro TTD ---');
    for (const nfe of postTtd) {
      if (TARGET.includes(nfe.numero)) {
        console.log(`NF ${nfe.numero} serie=${nfe.serie} chave=${nfe.chaveAcesso} refs=${nfe.refNFe.length}`);
        for (const ref of nfe.refNFe) {
          const refNumero = String(parseInt(ref.substring(25, 34), 10));
          const refExists = postTtd.some(n => n.chaveAcesso === ref);
          console.log(`  → ref ${refNumero} (${ref}) existeNoPeriodo=${refExists}`);
        }
      }
    }

    // Agora verificar a chave da 47685 para ver se ela está no set
    const nf47685 = postTtd.find(n => n.numero === '47685');
    const nf47782 = postTtd.find(n => n.numero === '47782');
    if (nf47685 && nf47782) {
      console.log(`\n--- Match check ---`);
      console.log(`47685 chave: ${nf47685.chaveAcesso}`);
      console.log(`47782 refNFe[0]: ${nf47782.refNFe[0]}`);
      console.log(`Match: ${nf47685.chaveAcesso === nf47782.refNFe[0]}`);
    }
  });
});
