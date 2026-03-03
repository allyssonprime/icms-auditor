import type { ItemData, DestData } from '../types/nfe.ts';
import type { AppConfig } from '../types/config.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { isNaoContribuinte } from './aliquota.ts';

function isTransferencia(cfop: string): boolean {
  return ['5152', '5155', '6152', '6155'].includes(cfop);
}

function isDevolucao(cfop: string): boolean {
  return ['1201', '1202', '2201', '2202', '5201', '5202', '6201', '6202'].includes(cfop);
}

export function classificarCenario(
  item: ItemData,
  dest: DestData,
  config: AppConfig,
): string {
  try {
    const isInterestadual = dest.uf.toUpperCase() !== 'SC';
    const isPF = !!dest.cpf && !dest.cnpj;
    const isPJNaoContribuinte = !isPF && isNaoContribuinte(dest);
    const isContribuinte = dest.indIEDest === '1';
    const isSN = !!dest.cnpj && config.listaSN.includes(dest.cnpj);

    const normalizedNcm = item.ncm.replace(/\./g, '');
    const isCAMEX = config.listaCamex.some(ncm => {
      const camexNorm = ncm.replace(/\./g, '');
      return normalizedNcm.startsWith(camexNorm);
    });

    const cobreAco = isCobreAco(item.ncm, config.listaCobreAco);

    const cstTrib = item.cst.length >= 2 ? item.cst.slice(-2) : item.cst;
    const temST = ['10', '30', '60', '70'].includes(cstTrib);

    // Devoluções
    if (isDevolucao(item.cfop)) {
      return 'DEVOLUCAO';
    }

    // Transferências
    if (isTransferencia(item.cfop)) {
      return isInterestadual ? 'A9' : 'B12';
    }

    // === INTERESTADUAIS ===
    if (isInterestadual) {
      if (cobreAco && isContribuinte && !isCAMEX) return 'A8';

      if (isCAMEX) {
        if (isContribuinte || isSN) return 'A2';
        if (isPJNaoContribuinte) return 'A5';
        if (isPF) return 'A7';
      }

      if (isContribuinte || isSN) return 'A1';
      if (isPJNaoContribuinte) return 'A4';
      if (isPF) return 'A6';
    }

    // === INTERNAS (SC) ===
    if (!isInterestadual) {
      // Vedações especiais primeiro
      if (dest.cnpj && config.listaVedacao25a.includes(dest.cnpj)) return 'B9';
      if (dest.cnpj && config.listaVedacao25b.includes(dest.cnpj)) return 'B10';

      // CD exclusivo
      if (dest.cnpj && config.listaCD.includes(dest.cnpj)) return 'B11';

      // Pessoa Física — SEM crédito presumido
      if (isPF) return 'B7';

      // PJ Não Contribuinte
      if (isPJNaoContribuinte) {
        return isCAMEX ? 'B6-CAMEX' : 'B6';
      }

      // Simples Nacional
      if (isSN) {
        if (temST) return isCAMEX ? 'B4-CAMEX' : 'B4';
        return isCAMEX ? 'B5-CAMEX' : 'B5';
      }

      // Contribuinte Normal
      // CAMEX sobrepõe Industrial: se item é CAMEX, aliquota é 12% mesmo para industrial
      if (isContribuinte) {
        if (isCAMEX) return 'B2';
        if (dest.cnpj && config.listaIndustriais.includes(dest.cnpj)) return 'B3';
        return 'B1';
      }
    }

    return 'DESCONHECIDO';
  } catch {
    return 'DESCONHECIDO';
  }
}
