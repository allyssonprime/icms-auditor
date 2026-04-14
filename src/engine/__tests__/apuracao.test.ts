import { describe, it, expect } from 'vitest';
import { buildApuracaoMensal, confrontarContabilidade } from '../apuracao.ts';
import { validarNfe } from '../validator.ts';
import { makeNfe, makeItem, makeDest, makeConfig } from './fixtures.ts';

function validar(nfe: ReturnType<typeof makeNfe>) {
  return validarNfe(nfe, makeConfig());
}

describe('buildApuracaoMensal', () => {
  describe('período', () => {
    it('extrai AAAA-MM de dhEmi quando não é informado explicitamente', () => {
      const nfe = makeNfe({
        dhEmi: '2026-03-15T10:30:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6101', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40,
          cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 30,
        })],
      });
      const ap = buildApuracaoMensal([validar(nfe)]);
      expect(ap.periodo).toBe('2026-03');
    });

    it('filtra NF-es fora do período informado', () => {
      const nfeMar = makeNfe({
        dhEmi: '2026-03-10T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6101', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40,
          cCredPresumido: 'CP1', pCredPresumido: 3, vCredPresumido: 30,
        })],
      });
      const nfeAbr = makeNfe({
        dhEmi: '2026-04-05T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6101', cst: '090', pICMS: 4, vBC: 2000, vICMS: 80,
          cCredPresumido: 'CP1', pCredPresumido: 3, vCredPresumido: 60,
        })],
      });
      const ap = buildApuracaoMensal(
        [validar(nfeMar), validar(nfeAbr)],
        undefined, undefined,
        '2026-03',
      );
      expect(ap.periodo).toBe('2026-03');
      expect(ap.totalBCSaidas).toBe(1000);
      expect(ap.qtdNfes).toBe(1);
    });
  });

  describe('totais de saídas (cenário A1 = interestadual contribuinte)', () => {
    it('calcula totalBCSaidas, totalICMSDestacado, totalICMSRecolher, totalFundos', () => {
      const nfe = makeNfe({
        dhEmi: '2026-03-01T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6101', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40,
          cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 30,
        })],
      });
      const ap = buildApuracaoMensal([validar(nfe)]);
      expect(ap.totalBCSaidas).toBe(1000);
      expect(ap.totalICMSDestacado).toBe(40);
      // A1: carga 1% sobre BC integral
      expect(ap.totalICMSRecolher).toBeCloseTo(10, 2);
      // Fundos 0,4% sobre BC integral
      expect(ap.totalFundos).toBeCloseTo(4, 2);
      expect(ap.totalRecolherComFundos).toBeCloseTo(14, 2);
      expect(ap.totalCPApropriado).toBe(30);
    });
  });

  describe('devoluções', () => {
    it('separa devoluções em totalBCDevolucoes + calcula líquido', () => {
      const venda = makeNfe({
        dhEmi: '2026-03-01T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6101', cst: '090', pICMS: 4, vBC: 10000, vICMS: 400,
          cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 300,
        })],
      });
      const devolucao = makeNfe({
        dhEmi: '2026-03-15T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6201', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40,
          cCredPresumido: 'CP123', pCredPresumido: 3, vCredPresumido: 30,
        })],
      });
      const ap = buildApuracaoMensal([validar(venda), validar(devolucao)]);

      expect(ap.totalBCSaidas).toBe(10000);
      expect(ap.totalBCDevolucoes).toBe(1000);
      expect(ap.totalCPEstornado).toBe(30);
      expect(ap.totalFundosCredito).toBeCloseTo(4, 2);
      // Líquido: saídas - devoluções nos fundos
      expect(ap.liquidoFundos).toBeCloseTo(40 - 4, 2);
    });
  });

  describe('porCenario', () => {
    it('agrupa itens por cenarioId e ordena', () => {
      const nfe = makeNfe({
        dhEmi: '2026-03-01T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [
          makeItem({
            nItem: '1', cfop: '6101', cst: '090', pICMS: 4, vBC: 1000, vICMS: 40,
            cCredPresumido: 'CP1', pCredPresumido: 3, vCredPresumido: 30,
          }),
          makeItem({
            nItem: '2', cfop: '6101', cst: '090', pICMS: 4, vBC: 500, vICMS: 20,
            cCredPresumido: 'CP1', pCredPresumido: 3, vCredPresumido: 15,
          }),
        ],
      });
      const ap = buildApuracaoMensal([validar(nfe)]);
      const a1 = ap.porCenario.find(c => c.cenarioId === 'A1');
      expect(a1).toBeDefined();
      expect(a1!.qtdItens).toBe(2);
      expect(a1!.totalBC).toBe(1500);
      expect(a1!.qtdNfes).toBe(1);
    });
  });

  describe('divergencias', () => {
    it('coleta resultados ERRO/DIVERGENCIA/AVISO de todos os itens', () => {
      // Item com pICMS errado → AL01 ERRO
      const nfe = makeNfe({
        dhEmi: '2026-03-01T10:00:00-03:00',
        dest: makeDest({ uf: 'PR', indIEDest: '1' }),
        itens: [makeItem({
          cfop: '6101', cst: '090', pICMS: 12, vBC: 1000, vICMS: 120,
          cCredPresumido: 'CP1',
        })],
      });
      const ap = buildApuracaoMensal([validar(nfe)]);
      expect(ap.divergencias.length).toBeGreaterThan(0);
      expect(ap.divergencias.some(d => d.regra === 'AL01' && d.status === 'ERRO')).toBe(true);
    });
  });

  describe('base vazia', () => {
    it('retorna zeros para lista vazia', () => {
      const ap = buildApuracaoMensal([]);
      expect(ap.totalBCSaidas).toBe(0);
      expect(ap.qtdItens).toBe(0);
      expect(ap.qtdNfes).toBe(0);
      expect(ap.porCenario).toHaveLength(0);
    });
  });
});

describe('confrontarContabilidade', () => {
  function mkApuracao(over: Partial<Parameters<typeof confrontarContabilidade>[0]> = {}) {
    return {
      periodo: '2026-03',
      totalBCSaidas: 100000,
      totalICMSDestacado: 4000,
      totalCPApropriado: 3000,
      totalICMSRecolher: 1000,
      totalFundos: 400,
      totalRecolherComFundos: 1400,
      totalBCDevolucoes: 0,
      totalCPEstornado: 0,
      totalFundosCredito: 0,
      liquidoICMSRecolher: 1000,
      liquidoFundos: 400,
      liquidoTotal: 1400,
      porCenario: [],
      divergencias: [],
      qtdNfes: 10,
      qtdItens: 50,
      ...over,
    };
  }

  it('retorna ok quando sistema e contabilidade convergem', () => {
    const ap = mkApuracao();
    const res = confrontarContabilidade(ap, {
      icmsDebitado: 4000, icmsCreditado: 3000, // líquido 1000
      cpApropriado: 3000,
      fundosRecolhidos: 400,
    });
    expect(res.status).toBe('ok');
    expect(res.diffICMS).toBeCloseTo(0, 2);
    expect(res.diffCP).toBeCloseTo(0, 2);
    expect(res.diffFundos).toBeCloseTo(0, 2);
  });

  it('retorna atencao para diferença entre 1% e 5%', () => {
    const ap = mkApuracao();
    const res = confrontarContabilidade(ap, {
      icmsDebitado: 4000, icmsCreditado: 2980, // líquido 1020 → diff 20 = 2%
      cpApropriado: 3000,
      fundosRecolhidos: 400,
    });
    expect(res.status).toBe('atencao');
    expect(res.diffICMS).toBeCloseTo(-20, 2);
  });

  it('retorna divergente para diferença > 5%', () => {
    const ap = mkApuracao();
    const res = confrontarContabilidade(ap, {
      icmsDebitado: 4000, icmsCreditado: 2500, // líquido 1500 → diff -500 = 33%
      cpApropriado: 3000,
      fundosRecolhidos: 400,
    });
    expect(res.status).toBe('divergente');
  });

  it('retorna divergente quando diferença absoluta > R$ 1.000,00', () => {
    const ap = mkApuracao({ liquidoICMSRecolher: 100000 });
    const res = confrontarContabilidade(ap, {
      icmsDebitado: 98500, icmsCreditado: 0, // 98500 → diff 1500 = 1,5% (atenção) MAS > 1000 → divergente
      cpApropriado: 3000,
      fundosRecolhidos: 400,
    });
    expect(res.status).toBe('divergente');
  });

  it('produz observação informando sentido da diferença', () => {
    const ap = mkApuracao();
    const res = confrontarContabilidade(ap, {
      icmsDebitado: 4000, icmsCreditado: 3050, // líquido 950 → diff +50
      cpApropriado: 3000,
      fundosRecolhidos: 400,
    });
    expect(res.observacoes.some(o => o.includes('sistema apurou a mais'))).toBe(true);
  });
});
