import { describe, it, expect } from 'vitest';
import { validarNfe } from '../validator.ts';
import { makeNfe, makeItem, makeDest, makeConfig } from './fixtures.ts';

describe('validarNfe', () => {
  it('should validate clean interstate NF-e as OK', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({ ncm: '84713019', cfop: '6101', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40 })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.statusFinal).toBe('OK');
    expect(result.itensValidados[0]!.cenario).toBe('A1');
  });

  it('should flag Decreto 2128 violation', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({ ncm: '22071000' })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.statusFinal).toBe('ERRO');
    expect(result.itensValidados[0]!.resultados.some(r => r.regra === 'V01')).toBe(true);
  });

  it('should flag wrong aliquota', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({ ncm: '84713019', cfop: '6101', cst: '090', pICMS: 12, cCredPresumido: 'CP123' })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.statusFinal).toBe('ERRO');
    expect(result.itensValidados[0]!.resultados.some(r => r.regra === 'AL01' && r.status === 'ERRO')).toBe(true);
  });

  it('should alert when CST origin is not 1 or 6 (nacional)', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({ ncm: '84713019', cfop: '6101', cstOrig: '0', cst: '090', pICMS: 4 })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.itensValidados[0]!.resultados.some(r => r.regra === 'CST02' && r.status === 'ALERTA')).toBe(true);
  });

  it('should accept CST with origin 1 and any trib (00, 51, 90)', () => {
    for (const cst of ['100', '151', '190']) {
      const nfe = makeNfe({
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({ ncm: '84713019', cfop: '6101', cstOrig: '1', cst, pICMS: 4 })],
      });
      const config = makeConfig();
      const result = validarNfe(nfe, config);

      const cstResults = result.itensValidados[0]!.resultados.filter(r => r.regra.startsWith('CST'));
      expect(cstResults.every(r => r.status === 'OK')).toBe(true);
    }
  });

  it('should validate internal SC PF as B7', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'SC', cpf: '12345678901', cnpj: undefined, indIEDest: '9' }),
      itens: [makeItem({ ncm: '84713019', cfop: '5102', cst: '000', pICMS: 17 })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.itensValidados[0]!.cenario).toBe('B7');
    expect(result.statusFinal).toBe('OK');
  });

  it('should handle mixed items (one OK, one ERRO)', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [
        makeItem({ nItem: '1', ncm: '84713019', cfop: '6101', cst: '090', pICMS: 4 }),
        makeItem({ nItem: '2', ncm: '84713019', cfop: '6101', cst: '090', pICMS: 12, cCredPresumido: 'CP123' }),
      ],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.statusFinal).toBe('ERRO');
    expect(result.itensValidados[0]!.statusFinal).toBe('OK');
    expect(result.itensValidados[1]!.statusFinal).toBe('ERRO');
  });

  it('should alert for DESCONHECIDO scenario', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'SC', indIEDest: '2', cnpj: undefined, cpf: undefined }),
      itens: [makeItem({ cfop: '5101', pICMS: 4 })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.itensValidados[0]!.cenario).toBe('DESCONHECIDO');
    expect(result.itensValidados[0]!.resultados.some(r => r.regra === 'C-UNK')).toBe(true);
  });

  it('should calculate totalBC and totalFundos', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [
        makeItem({ nItem: '1', vBC: 1000, pICMS: 4, cst: '090', cfop: '6101' }),
        makeItem({ nItem: '2', vBC: 2000, pICMS: 4, cst: '090', cfop: '6101' }),
      ],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.totalBC).toBe(3000);
    expect(result.totalFundos).toBeCloseTo(12); // 3000 * 0.004
  });

  it('should not charge fundos for B7 (PF)', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'SC', cpf: '12345678901', cnpj: undefined, indIEDest: '9' }),
      itens: [makeItem({ vBC: 1000, pICMS: 17, cst: '000', cfop: '5102' })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.totalFundos).toBe(0);
  });

  it('should handle devolucao CFOP', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({ cfop: '6201' })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.itensValidados[0]!.cenario).toBe('DEVOLUCAO');
    expect(result.itensValidados[0]!.resultados.some(r => r.regra === 'I09')).toBe(true);
  });
});
