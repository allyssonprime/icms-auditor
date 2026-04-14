/**
 * Investigação do residual de +0,71% na BC após filtros.
 * Compara NF a NF com os documentos do demonstrativo contábil.
 */
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

// NFs que aparecem no demonstrativo contábil (apenas numero, extraído das 7 paginas)
// Compilado das pages 1-5 do PDF
const NFS_CONTABIL = new Set([
  '47615','47617','47625','47642','47647','47665','47666','47668','47675','47681',
  '47691','47695','47703','47707','47712','47713','47734','47735','47736','47740',
  '47744','47750','47755','47765','47769','47773','47785','47787','47795','47797',
  '47799','47801','47810','47826','47853','47861','47870','47871','47873','47896',
  '47902','47903','47904','47905','47906','47907','47908','47909','47910','47949',
  '47928','47930','47935','47940','47969','47970','47971','47972','47973','47990',
  '47991','47959','47967','47975','48023','48027','48033','48035','48047','48101',
  '48117','48133','48137','48141','48149','48155','48161','48184',
  // Interestadual 1,00
  '48102',
  // Op. Interna 2,10
  '47657','47677','47729','47732','47888','47979','48007','48060','48180',
  // Op. Interna 3,60 (paginas 2-5)
  '47751','47611','47613','47619','47621','47623','47627','47629','47632','47633',
  '47635','47637','47638','47643','47645','47649','47650','47651','47653','47655',
  '47659','47673','47661','47663','47670','47672','47679','47683','47687','47689',
  '47693','47697','47699','47705','47709','47711','47715','47717','47719','47723',
  '47725','47727','47730','47738','47742','47746','47748','47753','47757','47759',
  '47761','47763','47767','47775','47776','47777','47778','47779','47781','47788',
  '47789','47790','47791','47793','47805','47806','47808','47812','47814','47816',
  '47818','47820','47821','47822','47823','47824','47828','47829','47830','47832',
  '47834','47835','47837','47839','47841','47843','47845','47847','47849','47851',
  '47854','47856','47857','47859','47862','47864','47866','47868','47874','47875',
  '47876','47877','47878','47879','47880','47882','47884','47886','47890','47892',
  '47894','47898','47899','47900','47912','47916','47920','47922','47924','47926',
  '47932','47933','47934','47937','47938','47942','47944','47946','47948','47951',
  '47954','47957','47961','47963','47965','47977','47981','47983','47985','47987',
  '47989','47993','47995','47997','47999','48001','48003','48009','48011','48015',
  '48017','48019','48021','48025','48029','48031','48037','48039','48041','48043',
  '48045','48049','48051','48053','48055','48056','48057','48058','48062','48065',
  '48067','48069','48071','48075','48077','48079','48081','48083','48084','48085',
  '48086','48087','48089','48091','48093','48095','48096','48097','48098','48099',
  '48104','48106','48108','48110','48115','48118','48119','48120','48121','48122',
  '48123','48124','48125','48127','48129','48131','48135','48139','48143','48145',
  '48147','48151','48156','48157','48158','48159','48163','48165','48167','48169',
  '48171','48174','48176','48177','48178','48182',
]);

describe('Investigação residual', () => {
  it('encontra NFs no sistema que NÃO estão no contábil', () => {
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

    // NFs aceitas com ICMS > 0 (excluir itens 0% que nao afetam totais)
    const comICMS = accepted.filter(nfe =>
      nfe.itens.some(i => i.vICMS > 0),
    );

    console.log(`\nNFs aceitas total: ${accepted.length}`);
    console.log(`NFs aceitas com ICMS > 0: ${comICMS.length}`);

    // NFs no sistema mas NAO no contabil
    const soNoSistema: Array<{ nf: string; serie: string; bc: number; icms: number; cfops: string }> = [];
    // NFs no contabil mas NAO no sistema
    const soNoContabil: string[] = [];

    const nfsNoSistema = new Set<string>();
    for (const nfe of comICMS) {
      nfsNoSistema.add(nfe.numero);
      if (!NFS_CONTABIL.has(nfe.numero)) {
        const totalBC = nfe.itens.reduce((s, i) => s + bcIntegral(i.vBC, i.pRedBC), 0);
        const totalICMS = nfe.itens.reduce((s, i) => s + i.vICMS, 0);
        const cfops = [...new Set(nfe.itens.map(i => i.cfop))].join(',');
        soNoSistema.push({ nf: nfe.numero, serie: nfe.serie, bc: totalBC, icms: totalICMS, cfops });
      }
    }

    for (const nf of NFS_CONTABIL) {
      if (!nfsNoSistema.has(nf)) {
        soNoContabil.push(nf);
      }
    }

    console.log(`\n--- NFs NO SISTEMA mas NÃO NO CONTÁBIL (${soNoSistema.length}) ---`);
    let bcExtra = 0;
    let icmsExtra = 0;
    for (const n of soNoSistema.sort((a, b) => a.nf.localeCompare(b.nf))) {
      console.log(`  NF ${n.nf} (serie ${n.serie}) CFOPs=${n.cfops}  BC=${fmt(n.bc)}  ICMS=${fmt(n.icms)}`);
      bcExtra += n.bc;
      icmsExtra += n.icms;
    }
    console.log(`  TOTAL EXTRA: BC=${fmt(bcExtra)}  ICMS=${fmt(icmsExtra)}`);

    console.log(`\n--- NFs NO CONTÁBIL mas NÃO NO SISTEMA (${soNoContabil.length}) ---`);
    for (const nf of soNoContabil.sort()) {
      console.log(`  NF ${nf}`);
    }

    // NFs que aparecem em AMBOS mas com BC diferente
    console.log(`\n--- NFs com BC integral divergente ---`);
    // Para cada NF no contabil, somar BC integral dos itens 5949/5102/6102 do sistema
    // (excluir itens 3949 que sao importacao sem BC)
    let bcDiffTotal = 0;
    for (const nfe of comICMS) {
      if (!NFS_CONTABIL.has(nfe.numero)) continue;
      const itensTributados = nfe.itens.filter(i => i.vICMS > 0);
      const bcSist = itensTributados.reduce((s, i) => s + bcIntegral(i.vBC, i.pRedBC), 0);
      // Não temos BC contábil individual, mas podemos ao menos listar NFs com itens em CFOP misto
      const cfops = [...new Set(itensTributados.map(i => i.cfop))];
      if (cfops.length > 1) {
        const icms = itensTributados.reduce((s, i) => s + i.vICMS, 0);
        console.log(`  NF ${nfe.numero}: CFOPs mistos ${cfops.join(',')}  BC=${fmt(bcSist)}  ICMS=${fmt(icms)}`);
      }
    }
  });
});
