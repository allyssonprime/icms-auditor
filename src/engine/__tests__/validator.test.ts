import { describe, it, expect } from 'vitest';
import { validarNfe } from '../validator.ts';
import { makeNfe, makeItem, makeDest, makeConfig } from './fixtures.ts';

describe('validarNfe', () => {
  it('should validate clean interstate NF-e as OK', () => {
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({
        ncm: '84713019', cfop: '6101', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40,
        cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 30,
      })],
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

    expect(result.itensValidados[0]!.resultados.some(r => r.regra === 'CST02' && r.status === 'AVISO')).toBe(true);
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
      itens: [makeItem({ ncm: '84713019', cfop: '5102', cst: '000', pICMS: 17, vICMS: 170 })],
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
        makeItem({
          nItem: '1', ncm: '84713019', cfop: '6101', cst: '090', pICMS: 4,
          cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 30,
        }),
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
    const cunk = result.itensValidados[0]!.resultados.find(r => r.regra === 'C-UNK');
    expect(cunk).toBeDefined();
    // Mensagem deve incluir contexto diagnostico (CFOP + campos derivados)
    expect(cunk!.mensagem).toContain('CFOP 5101');
    expect(cunk!.mensagem).toContain('operacao=');
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

  it('should use carga 3.6% (not 1%) when pICMS=10 diverges from cenario', () => {
    // Cenario interno B1 (contribuinte normal em SC) espera 4% com carga 1%.
    // Se a NF vier com pICMS=10, o recolher deve ser 3.6% da BC, NAO 1%.
    const nfe = makeNfe({
      dest: makeDest({ uf: 'SC', indIEDest: '1' }),
      itens: [makeItem({ ncm: '84713019', cfop: '5101', cst: '090', pICMS: 10, vBC: 1000, vICMS: 100 })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    // totalICMSRecolher deve ser ~3,6% de 1000 = 36 (nao 10 = 1%)
    expect(result.totalICMSRecolher).toBeCloseTo(36, 1);
  });

  it('should use BC integral × carga when pRedBC > 0 (regra fiscal: reducao de BC nao reduz obrigacao)', () => {
    // Quando ha reducao de BC, o ICMS a recolher continua sendo calculado
    // sobre a base integral × carga efetiva do cenario. A reducao de BC
    // nao reduz a obrigacao de recolhimento sob o TTD.
    // vProd=1000, pRedBC=47.06% → vBC=529.40, pICMS=4 → vICMS=21.18.
    // Cenario A1 carga 1% → recolher correto = 1000 × 1% = 10.
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [makeItem({
        ncm: '84713019', cfop: '6101', cst: '090',
        pICMS: 4, vBC: 529.40, pRedBC: 47.06, vProd: 1000, vICMS: 21.18,
      })],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.totalICMSRecolher).toBeCloseTo(10, 1);
  });

  it('NF mista: item sem pRedBC (via CP) + item com pRedBC, ambos sobre BC integral', () => {
    // Item 1: sem pRedBC, pICMS=4, cenario A1 carga 1% → bcInt=1000 × 1% = 10
    // Item 2: com pRedBC=50, vBC=500, pICMS=17 → bcInt=1000, pICMS diverge
    //         de A1 (espera 4%) → carga derivada 3.6% → recolher = 1000 × 3.6% = 36
    // Total esperado = 10 + 36 = 46
    const nfe = makeNfe({
      dest: makeDest({ uf: 'PR', indIEDest: '1' }),
      itens: [
        makeItem({
          nItem: '1', ncm: '84713019', cfop: '6101', cst: '090',
          pICMS: 4, vBC: 1000, vICMS: 40,
          cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 30,
        }),
        makeItem({
          nItem: '2', ncm: '84713019', cfop: '6101', cst: '120',
          pICMS: 17, vBC: 500, pRedBC: 50, vProd: 1000, vICMS: 85,
        }),
      ],
    });
    const config = makeConfig();
    const result = validarNfe(nfe, config);

    expect(result.totalICMSRecolher).toBeCloseTo(46, 2);
    // totalCPEsperado: ambos os itens sao considerados.
    //   Item 1: A1 temCP=true, pICMS=4, carga=1 → cp esp = 1000 × 3% = 30
    //   Item 2: A1 temCP=true, pICMS=17, carga derivada=3.6 → cp esp = 1000 × 13.4% = 134
    // Total = 164
    expect(result.totalCPEsperado).toBeCloseTo(164, 1);
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
