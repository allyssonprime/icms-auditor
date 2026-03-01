import type { NfeData, DestData, ItemData } from '../types/nfe.ts';

export type ParseResult =
  | { success: true; data: NfeData }
  | { success: false; error: string };

function stripNamespaces(xml: string): string {
  return xml
    .replace(/\s+xmlns\s*=\s*"[^"]*"/g, '')
    .replace(/\s+xmlns:\w+\s*=\s*"[^"]*"/g, '');
}

function getText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? '';
}

function getNumber(parent: Element, tagName: string): number {
  const val = parseFloat(getText(parent, tagName));
  return isNaN(val) ? 0 : val;
}

function parseDestinatario(doc: Document): DestData {
  const dest = doc.getElementsByTagName('dest')[0];
  if (!dest) {
    return { nome: '', uf: 'SC', indIEDest: '1' };
  }

  const cnpj = getText(dest, 'CNPJ') || undefined;
  const cpf = getText(dest, 'CPF') || undefined;
  const nome = getText(dest, 'xNome');
  const enderDest = dest.getElementsByTagName('enderDest')[0];
  const uf = enderDest ? getText(enderDest, 'UF') : '';
  const ie = getText(dest, 'IE') || undefined;
  const indIEDest = getText(dest, 'indIEDest') || '1';

  return { cnpj, cpf, nome, uf, ie, indIEDest };
}

function parseItem(det: Element): ItemData {
  const nItem = det.getAttribute('nItem') ?? '0';
  const prod = det.getElementsByTagName('prod')[0];
  const descricao = prod ? getText(prod, 'xProd') : '';
  const ncm = prod ? getText(prod, 'NCM').replace(/\./g, '') : '';
  const cfop = prod ? getText(prod, 'CFOP') : '';
  const vProd = prod ? getNumber(prod, 'vProd') : 0;

  const icmsGroup = det.getElementsByTagName('ICMS')[0];
  let cstOrig = '0';
  let cstTrib = '00';
  let pICMS = 0;
  let vBC = 0;
  let vICMS = 0;
  let vBCST = 0;
  let vICMSST = 0;

  if (icmsGroup) {
    const icmsChild = icmsGroup.children[0];
    if (icmsChild) {
      cstOrig = getText(icmsChild, 'orig') || '0';
      cstTrib = getText(icmsChild, 'CST') || getText(icmsChild, 'CSOSN') || '00';
      pICMS = getNumber(icmsChild, 'pICMS');
      vBC = getNumber(icmsChild, 'vBC');
      vICMS = getNumber(icmsChild, 'vICMS');
      vBCST = getNumber(icmsChild, 'vBCST');
      vICMSST = getNumber(icmsChild, 'vICMSST');
    }
  }

  const cst = cstOrig + cstTrib;

  return {
    nItem,
    descricao,
    ncm,
    cfop,
    cstOrig,
    cst,
    pICMS,
    vBC,
    vICMS,
    vProd,
    vBCST,
    vICMSST,
  };
}

export function parseNfe(xmlString: string, fileName: string = ''): ParseResult {
  try {
    const cleanXml = stripNamespaces(xmlString);
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanXml, 'text/xml');

    const parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      return { success: false, error: `XML malformado: ${parseError.textContent}` };
    }

    const infNFe = doc.getElementsByTagName('infNFe')[0];
    if (!infNFe) {
      return { success: false, error: 'Elemento <infNFe> não encontrado' };
    }

    const idAttr = infNFe.getAttribute('Id') ?? '';
    const chaveAcesso = idAttr.replace(/^NFe/, '');

    const ide = doc.getElementsByTagName('ide')[0];
    const numero = ide ? getText(ide, 'nNF') : '';
    const serie = ide ? getText(ide, 'serie') : '';
    const natOp = ide ? getText(ide, 'natOp') : '';
    const tpNF = ide ? getText(ide, 'tpNF') : '1';

    const dest = parseDestinatario(doc);

    const infAdic = doc.getElementsByTagName('infAdic')[0];
    const infCpl = infAdic ? getText(infAdic, 'infCpl') : '';

    const detElements = doc.getElementsByTagName('det');
    const itens: ItemData[] = [];
    for (let i = 0; i < detElements.length; i++) {
      itens.push(parseItem(detElements[i]!));
    }

    if (itens.length === 0) {
      return { success: false, error: 'Nenhum item encontrado na NF-e' };
    }

    return {
      success: true,
      data: {
        chaveAcesso,
        numero,
        serie,
        natOp,
        tpNF,
        dest,
        itens,
        infCpl,
        fileName,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Erro ao parsear XML: ${msg}` };
  }
}
