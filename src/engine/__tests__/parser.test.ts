import { describe, it, expect } from 'vitest';
import { parseNfe } from '../parser.ts';
import { makeSampleXml } from './fixtures.ts';

describe('parseNfe', () => {
  it('should parse a valid NF-e XML', () => {
    const xml = makeSampleXml();
    const result = parseNfe(xml, 'test.xml');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.numero).toBe('123456');
    expect(result.data.serie).toBe('1');
    expect(result.data.natOp).toBe('Venda de mercadoria');
    expect(result.data.tpNF).toBe('1');
    expect(result.data.fileName).toBe('test.xml');
    expect(result.data.emitCnpj).toBe('00000000000100');
    expect(result.data.emitNome).toBe('Emitente Teste Ltda');
    expect(result.data.emitUF).toBe('SC');
    expect(result.data.dest.cnpj).toBe('12345678000199');
    expect(result.data.dest.uf).toBe('PR');
    expect(result.data.dest.indIEDest).toBe('1');
    expect(result.data.itens).toHaveLength(1);
    expect(result.data.infCpl).toBe('Informacoes complementares teste');
  });

  it('should extract item data correctly', () => {
    const xml = makeSampleXml({ ncm: '85176239', pICMS: 12, vBC: 2000, vICMS: 240 });
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const item = result.data.itens[0]!;
    expect(item.ncm).toBe('85176239');
    expect(item.cfop).toBe('6101');
    expect(item.cst).toBe('190');
    expect(item.cstOrig).toBe('1');
    expect(item.pICMS).toBe(12);
    expect(item.vBC).toBe(2000);
    expect(item.vICMS).toBe(240);
  });

  it('should extract chave de acesso stripping NFe prefix', () => {
    const xml = makeSampleXml();
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.chaveAcesso).toBe('42000000000000000000000000000000000000000000');
  });

  it('should return error for malformed XML', () => {
    const result = parseNfe('not xml at all', 'bad.xml');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('malformado');
  });

  it('should return error when no items found', () => {
    const xml = `<?xml version="1.0"?>
    <nfeProc>
      <NFe>
        <infNFe Id="NFe123">
          <ide><nNF>1</nNF><serie>1</serie><natOp>Venda</natOp><tpNF>1</tpNF></ide>
          <dest><CNPJ>12345678000199</CNPJ><xNome>Test</xNome><enderDest><UF>SC</UF></enderDest><indIEDest>1</indIEDest></dest>
        </infNFe>
      </NFe>
    </nfeProc>`;
    const result = parseNfe(xml);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Nenhum item');
  });

  it('should handle XML with CPF destination (PF)', () => {
    const xml = makeSampleXml({ destCPF: '12345678901', destCNPJ: undefined, indIEDest: '9' });
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.dest.cpf).toBe('12345678901');
    expect(result.data.dest.cnpj).toBeUndefined();
    expect(result.data.dest.indIEDest).toBe('9');
  });

  it('should strip XML namespaces and still parse', () => {
    const xml = makeSampleXml();
    expect(xml).toContain('xmlns=');
    const result = parseNfe(xml);
    expect(result.success).toBe(true);
  });

  it('should extract vFrete, vSeg, vDesc, vOutro from prod', () => {
    const xml = makeSampleXml({ vFrete: 50, vSeg: 10, vDesc: 20, vOutro: 5 });
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const item = result.data.itens[0]!;
    expect(item.vFrete).toBe(50);
    expect(item.vSeg).toBe(10);
    expect(item.vDesc).toBe(20);
    expect(item.vOutro).toBe(5);
  });

  it('should default vFrete/vSeg/vDesc/vOutro to 0 when absent', () => {
    const xml = makeSampleXml();
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const item = result.data.itens[0]!;
    expect(item.vFrete).toBe(0);
    expect(item.vSeg).toBe(0);
    expect(item.vDesc).toBe(0);
    expect(item.vOutro).toBe(0);
  });

  it('should parse ICMSTot totals when present', () => {
    const xml = makeSampleXml({
      withTotais: true,
      vBC: 1000,
      vICMS: 40,
      vFrete: 50,
      vSeg: 10,
      vDesc: 20,
      vOutro: 5,
    });
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totais.vBC).toBe(1000);
    expect(result.data.totais.vICMS).toBe(40);
    expect(result.data.totais.vProd).toBe(1000);
    expect(result.data.totais.vFrete).toBe(50);
    expect(result.data.totais.vSeg).toBe(10);
    expect(result.data.totais.vDesc).toBe(20);
    expect(result.data.totais.vOutro).toBe(5);
    expect(result.data.totais.vNF).toBe(1045); // 1000 + 50 + 10 + 5 - 20
  });

  it('should default totais to zeros when ICMSTot is absent', () => {
    const xml = makeSampleXml();
    const result = parseNfe(xml);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totais.vBC).toBe(0);
    expect(result.data.totais.vICMS).toBe(0);
    expect(result.data.totais.vProd).toBe(0);
    expect(result.data.totais.vNF).toBe(0);
  });

  it('should default numeric fields to 0 when missing', () => {
    const xml = `<?xml version="1.0"?>
    <nfeProc>
      <NFe>
        <infNFe Id="NFe123">
          <ide><nNF>1</nNF><serie>1</serie><natOp>Venda</natOp><tpNF>1</tpNF></ide>
          <dest><CNPJ>12345678000199</CNPJ><xNome>Test</xNome><enderDest><UF>SC</UF></enderDest><indIEDest>1</indIEDest></dest>
          <det nItem="1">
            <prod><xProd>Prod</xProd><NCM>84713019</NCM><CFOP>5101</CFOP><vProd>100</vProd></prod>
            <imposto><ICMS><ICMS60><orig>0</orig><CST>60</CST></ICMS60></ICMS></imposto>
          </det>
        </infNFe>
      </NFe>
    </nfeProc>`;
    const result = parseNfe(xml);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const item = result.data.itens[0]!;
    expect(item.pICMS).toBe(0);
    expect(item.vBC).toBe(0);
    expect(item.vICMS).toBe(0);
  });
});
