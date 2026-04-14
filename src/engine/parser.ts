import type { NfeData, DestData, ItemData, NfeTotais } from '../types/nfe.ts';

export type ParseResult =
  | { success: true; data: NfeData }
  | { success: false; error: string };

function sanitizeXml(xml: string): string {
  // Remove BOM if present
  let clean = xml.replace(/^\uFEFF/, '');
  // Remove duplicate <?xml ...?> declarations (common in NFe cancelada files
  // where procEventoNFe is concatenated after nfeProc)
  clean = clean.replace(/<\?xml\s[^?]*\?>\s*/g, '');
  // Strip namespace declarations
  clean = clean
    .replace(/\s+xmlns\s*=\s*"[^"]*"/g, '')
    .replace(/\s+xmlns:\w+\s*=\s*"[^"]*"/g, '');
  return clean;
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
  const vFrete = prod ? getNumber(prod, 'vFrete') : 0;
  const vSeg = prod ? getNumber(prod, 'vSeg') : 0;
  const vDesc = prod ? getNumber(prod, 'vDesc') : 0;
  const vOutro = prod ? getNumber(prod, 'vOutro') : 0;

  const icmsGroup = det.getElementsByTagName('ICMS')[0];
  let cstOrig = '0';
  let cstTrib = '00';
  let pICMS = 0;
  let vBC = 0;
  let vICMS = 0;
  let pRedBC = 0;
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
      pRedBC = getNumber(icmsChild, 'pRedBC');
      vBCST = getNumber(icmsChild, 'vBCST');
      vICMSST = getNumber(icmsChild, 'vICMSST');
    }
  }

  const cst = cstOrig + cstTrib;

  // Parse gCred (Credito Presumido) - pode estar em imposto ou dentro de ICMS
  let cCredPresumido = '';
  let pCredPresumido = 0;
  let vCredPresumido = 0;
  const gCredElements = det.getElementsByTagName('gCred');
  if (gCredElements.length > 0) {
    const gCred = gCredElements[0]!;
    cCredPresumido = getText(gCred, 'cCredPresumido');
    pCredPresumido = getNumber(gCred, 'pCredPresumido');
    vCredPresumido = getNumber(gCred, 'vCredPresumido');
  } else {
    // Fallback: buscar tags diretamente no det
    cCredPresumido = getText(det, 'cCredPresumido');
    pCredPresumido = getNumber(det, 'pCredPresumido');
    vCredPresumido = getNumber(det, 'vCredPresumido');
  }

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
    pRedBC,
    vBCST,
    vICMSST,
    vFrete,
    vSeg,
    vDesc,
    vOutro,
    cCredPresumido,
    pCredPresumido,
    vCredPresumido,
  };
}

function parseTotais(doc: Document): NfeTotais {
  const empty: NfeTotais = {
    vBC: 0, vICMS: 0, vBCST: 0, vST: 0, vProd: 0,
    vFrete: 0, vSeg: 0, vDesc: 0, vOutro: 0, vNF: 0,
  };
  const icmsTot = doc.getElementsByTagName('ICMSTot')[0];
  if (!icmsTot) return empty;
  return {
    vBC: getNumber(icmsTot, 'vBC'),
    vICMS: getNumber(icmsTot, 'vICMS'),
    vBCST: getNumber(icmsTot, 'vBCST'),
    vST: getNumber(icmsTot, 'vST'),
    vProd: getNumber(icmsTot, 'vProd'),
    vFrete: getNumber(icmsTot, 'vFrete'),
    vSeg: getNumber(icmsTot, 'vSeg'),
    vDesc: getNumber(icmsTot, 'vDesc'),
    vOutro: getNumber(icmsTot, 'vOutro'),
    vNF: getNumber(icmsTot, 'vNF'),
  };
}

export function parseNfe(xmlString: string, fileName: string = ''): ParseResult {
  try {
    const cleanXml = sanitizeXml(xmlString);
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
    const dhEmi = ide ? getText(ide, 'dhEmi') || getText(ide, 'dEmi') : '';

    // NFref: chaves de NF-es referenciadas (usadas em estornos)
    const refNFe: string[] = [];
    const finNFe = ide ? getText(ide, 'finNFe') || '1' : '1';
    if (ide) {
      const nfRefElements = ide.getElementsByTagName('refNFe');
      for (let i = 0; i < nfRefElements.length; i++) {
        const ref = nfRefElements[i]?.textContent?.trim();
        if (ref) refNFe.push(ref);
      }
    }

    const emit = doc.getElementsByTagName('emit')[0];
    const emitCnpj = emit ? getText(emit, 'CNPJ') : '';
    const emitNome = emit ? getText(emit, 'xNome') : '';
    const enderEmit = emit?.getElementsByTagName('enderEmit')[0];
    const emitUF = enderEmit ? getText(enderEmit, 'UF') : 'SC';

    const dest = parseDestinatario(doc);

    const infAdic = doc.getElementsByTagName('infAdic')[0];
    const infCplRaw = infAdic ? getText(infAdic, 'infCpl') : '';
    const infAdFisco = infAdic ? getText(infAdic, 'infAdFisco') : '';
    // Concatena ambos os campos para que filtros (ex: TTD) encontrem o texto
    // independente de onde o emitente colocou a informacao.
    const infCpl = [infCplRaw, infAdFisco].filter(Boolean).join(' | ');

    const detElements = doc.getElementsByTagName('det');
    const itens: ItemData[] = [];
    for (let i = 0; i < detElements.length; i++) {
      itens.push(parseItem(detElements[i]!));
    }

    if (itens.length === 0) {
      return { success: false, error: 'Nenhum item encontrado na NF-e' };
    }

    const totais = parseTotais(doc);

    return {
      success: true,
      data: {
        chaveAcesso,
        numero,
        serie,
        natOp,
        tpNF,
        dhEmi,
        emitCnpj,
        emitNome,
        emitUF,
        dest,
        itens,
        infCpl,
        fileName,
        totais,
        refNFe,
        finNFe,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Erro ao parsear XML: ${msg}` };
  }
}
