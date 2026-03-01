import type { ItemData, DestData, NfeData } from '../../types/nfe.ts';
import type { AppConfig } from '../../types/config.ts';
import { DECRETO_2128 } from '../../data/decreto2128.ts';
import { COBRE_ACO_PREFIXES } from '../../data/cobreAco.ts';
import { ALIQUOTAS_INTERNAS_VALIDAS } from '../../data/aliquotasInternas.ts';

export function makeItem(overrides: Partial<ItemData> = {}): ItemData {
  return {
    nItem: '1',
    descricao: 'Produto teste',
    ncm: '84713019',
    cfop: '6101',
    cstOrig: '0',
    cst: '090',
    pICMS: 4,
    vBC: 1000,
    vICMS: 40,
    vProd: 1000,
    vBCST: 0,
    vICMSST: 0,
    ...overrides,
  };
}

export function makeDest(overrides: Partial<DestData> = {}): DestData {
  return {
    cnpj: '12345678000199',
    nome: 'Empresa Teste Ltda',
    uf: 'PR',
    ie: '1234567890',
    indIEDest: '1',
    ...overrides,
  };
}

export function makeNfe(overrides: Partial<NfeData> = {}): NfeData {
  return {
    chaveAcesso: '42000000000000000000000000000000000000000000',
    numero: '123456',
    serie: '1',
    natOp: 'Venda de mercadoria',
    tpNF: '1',
    dest: makeDest(),
    itens: [makeItem()],
    infCpl: '',
    fileName: 'test.xml',
    ...overrides,
  };
}

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    decreto2128: DECRETO_2128,
    listaCamex: [],
    listaCobreAco: COBRE_ACO_PREFIXES,
    listaSN: [],
    listaIndustriais: [],
    listaCD: [],
    listaVedacao25a: [],
    listaVedacao25b: [],
    ufAliquotas: {},
    aliquotasInternasValidas: ALIQUOTAS_INTERNAS_VALIDAS,
    ...overrides,
  };
}

export function makeSampleXml(opts: {
  ncm?: string;
  cfop?: string;
  cstOrig?: string;
  cst?: string;
  pICMS?: number;
  vBC?: number;
  vICMS?: number;
  destUF?: string;
  destCNPJ?: string;
  destCPF?: string;
  indIEDest?: string;
  numero?: string;
} = {}): string {
  const {
    ncm = '84713019',
    cfop = '6101',
    cstOrig = '0',
    cst = '90',
    pICMS = 4,
    vBC = 1000,
    vICMS = 40,
    destUF = 'PR',
    destCNPJ = '12345678000199',
    destCPF,
    indIEDest = '1',
    numero = '123456',
  } = opts;

  const destId = destCPF
    ? `<CPF>${destCPF}</CPF>`
    : `<CNPJ>${destCNPJ}</CNPJ>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe42000000000000000000000000000000000000000000" versao="4.00">
      <ide>
        <nNF>${numero}</nNF>
        <serie>1</serie>
        <natOp>Venda de mercadoria</natOp>
        <tpNF>1</tpNF>
      </ide>
      <dest>
        ${destId}
        <xNome>Empresa Teste Ltda</xNome>
        <enderDest>
          <UF>${destUF}</UF>
        </enderDest>
        <indIEDest>${indIEDest}</indIEDest>
        <IE>1234567890</IE>
      </dest>
      <det nItem="1">
        <prod>
          <xProd>Produto teste</xProd>
          <NCM>${ncm}</NCM>
          <CFOP>${cfop}</CFOP>
          <vProd>${vBC}</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS90>
              <orig>${cstOrig}</orig>
              <CST>${cst}</CST>
              <vBC>${vBC}</vBC>
              <pICMS>${pICMS}</pICMS>
              <vICMS>${vICMS}</vICMS>
            </ICMS90>
          </ICMS>
        </imposto>
      </det>
      <infAdic>
        <infCpl>Informacoes complementares teste</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</nfeProc>`;
}
