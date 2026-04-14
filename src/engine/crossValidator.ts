import type { NfeData } from '../types/nfe';
import type { EfdData, EfdC100 } from '../types/efd';
import type { CrossValidationResult, NfCrossMatch } from '../types/crossValidation';

const DEFAULT_TOLERANCE = 0.02;

/** Normalize serie: strip leading zeros for comparison ('001' → '1') */
function normalizeSerie(serie: string): string {
  return serie.replace(/^0+/, '') || '0';
}

/**
 * Cross-validate XML NF-e data against EFD/SPED data.
 *
 * Only compares saídas: XML tpNF=1 vs EFD indOper=1/indEmit=0.
 */
export function crossValidate(
  xmlNfes: NfeData[],
  canceladasSet: Set<string>,
  efd: EfdData,
  tolerance: number = DEFAULT_TOLERANCE,
): CrossValidationResult {
  // Filter both sides to saídas only
  const xmlSaidas = xmlNfes.filter(nfe => nfe.tpNF === '1');
  const efdSaidas = efd.c100s.filter(c => c.indOper === '1' && c.indEmit === '0');

  // Index EFD by chvNfe (primary) and numDoc_normalizedSerie (fallback)
  const efdByChave = new Map<string, EfdC100>();
  const efdByNumSerie = new Map<string, EfdC100>();
  for (const c of efdSaidas) {
    if (c.chvNfe) efdByChave.set(c.chvNfe, c);
    efdByNumSerie.set(`${c.numDoc}_${normalizeSerie(c.serie)}`, c);
  }

  const matches: NfCrossMatch[] = [];
  const matchedEfdKeys = new Set<string>();
  let matchedCount = 0;
  let onlyXmlCount = 0;
  let valueDivergentCount = 0;
  let xmlTotalIcms = 0;

  // Process each XML saída
  for (const nfe of xmlSaidas) {
    xmlTotalIcms += nfe.totais.vICMS;

    // Try to find EFD match: chave de acesso first, then numero+serie fallback
    let efdMatch: EfdC100 | undefined;
    let matchKey = '';

    if (nfe.chaveAcesso && efdByChave.has(nfe.chaveAcesso)) {
      efdMatch = efdByChave.get(nfe.chaveAcesso);
      matchKey = nfe.chaveAcesso;
    } else {
      const fallbackKey = `${nfe.numero}_${normalizeSerie(nfe.serie)}`;
      if (efdByNumSerie.has(fallbackKey)) {
        efdMatch = efdByNumSerie.get(fallbackKey);
        matchKey = efdMatch!.chvNfe || fallbackKey;
      }
    }

    const xmlCancelada = canceladasSet.has(nfe.chaveAcesso);
    const xmlHasTtd = /ttd/i.test(nfe.infCpl);
    const xmlEstornada = nfe.refNFe.length > 0;

    if (!efdMatch) {
      onlyXmlCount++;
      matches.push({
        numDoc: nfe.numero,
        serie: nfe.serie,
        chaveAcesso: nfe.chaveAcesso,
        matchStatus: 'only_xml',
        xmlVlBcIcms: nfe.totais.vBC,
        xmlVlIcms: nfe.totais.vICMS,
        xmlCancelada,
        xmlHasTtd,
        xmlEstornada,
        flagDivergences: [],
      });
      continue;
    }

    // Mark EFD entry as matched
    matchedEfdKeys.add(matchKey);
    if (efdMatch.chvNfe) matchedEfdKeys.add(efdMatch.chvNfe);
    matchedEfdKeys.add(`${efdMatch.numDoc}_${efdMatch.serie}`);

    // Compare values — skip when either side is cancelled (EFD zeros all values for COD_SIT=02)
    const eitherCancelled = xmlCancelada || efdMatch.isCancelado;
    const diffBc = eitherCancelled ? 0 : Math.abs(nfe.totais.vBC - efdMatch.vlBcIcms);
    const diffIcms = eitherCancelled ? 0 : Math.abs(nfe.totais.vICMS - efdMatch.vlIcms);
    const hasValueDivergence = !eitherCancelled && (diffBc > tolerance || diffIcms > tolerance);

    // Compare flags
    const flagDivergences: string[] = [];
    if (xmlCancelada !== efdMatch.isCancelado) flagDivergences.push('cancelada');
    if (xmlHasTtd !== efdMatch.hasTtd) flagDivergences.push('ttd');
    if (xmlEstornada !== efdMatch.isEstornada) flagDivergences.push('estornada');

    const matchStatus = hasValueDivergence ? 'value_divergent' as const : 'matched' as const;
    if (hasValueDivergence) valueDivergentCount++;
    else matchedCount++;

    matches.push({
      numDoc: nfe.numero,
      serie: nfe.serie,
      chaveAcesso: nfe.chaveAcesso,
      matchStatus,
      xmlVlBcIcms: nfe.totais.vBC,
      xmlVlIcms: nfe.totais.vICMS,
      xmlCancelada,
      xmlHasTtd,
      xmlEstornada,
      efdVlBcIcms: efdMatch.vlBcIcms,
      efdVlIcms: efdMatch.vlIcms,
      efdCancelado: efdMatch.isCancelado,
      efdHasTtd: efdMatch.hasTtd,
      efdEstornada: efdMatch.isEstornada,
      diffBcIcms: diffBc,
      diffIcms: diffIcms,
      flagDivergences,
    });
  }

  // Find EFD entries not matched to any XML
  let onlyEfdCount = 0;
  for (const c of efdSaidas) {
    const key1 = c.chvNfe;
    const key2 = `${c.numDoc}_${c.serie}`;
    if (!matchedEfdKeys.has(key1) && !matchedEfdKeys.has(key2)) {
      onlyEfdCount++;
      matches.push({
        numDoc: c.numDoc,
        serie: c.serie,
        chaveAcesso: c.chvNfe || undefined,
        matchStatus: 'only_efd',
        efdVlBcIcms: c.vlBcIcms,
        efdVlIcms: c.vlIcms,
        efdCancelado: c.isCancelado,
        efdHasTtd: c.hasTtd,
        efdEstornada: c.isEstornada,
        flagDivergences: [],
      });
    }
  }

  const efdTotalDebitos = efd.e110?.vlTotDebitos ?? 0;
  const diffTotalDebitos = Math.abs(xmlTotalIcms - efdTotalDebitos);

  return {
    competencia: efd.company.competencia,
    totalXml: xmlSaidas.length,
    totalEfd: efdSaidas.length,
    matched: matchedCount,
    onlyXml: onlyXmlCount,
    onlyEfd: onlyEfdCount,
    valueDivergent: valueDivergentCount,
    matches,
    xmlTotalDebitos: xmlTotalIcms,
    efdTotalDebitos,
    diffTotalDebitos,
    isConsistent: onlyXmlCount === 0 && valueDivergentCount === 0 && matches.every(m => m.flagDivergences.length === 0),
  };
}
