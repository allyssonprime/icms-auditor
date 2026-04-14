import { describe, it, expect } from 'vitest';
import { validarBaseCalculo, isBcConsistente } from '../bcValidation.ts';
import { makeItem } from './fixtures.ts';

describe('validarBaseCalculo', () => {
  describe('BC01 — consistência matemática', () => {
    it('passa quando vBC × pICMS = vICMS', () => {
      const item = makeItem({ vBC: 1000, pICMS: 4, vICMS: 40 });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC01')).toBe(false);
    });

    it('passa com tolerância de 0.01 (arredondamento)', () => {
      const item = makeItem({ vBC: 333.33, pICMS: 12, vICMS: 40.0 }); // 39.9996
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC01')).toBe(false);
    });

    it('emite ERRO quando vICMS diverge de BC × pICMS', () => {
      const item = makeItem({ vBC: 1000, pICMS: 4, vICMS: 50 });
      const results = validarBaseCalculo(item);
      const bc01 = results.find(r => r.regra === 'BC01');
      expect(bc01).toBeDefined();
      expect(bc01?.status).toBe('ERRO');
      expect(bc01?.mensagem).toContain('Inconsist');
    });

    it('pula a checagem quando pICMS = 0 (sem ICMS próprio)', () => {
      const item = makeItem({ vBC: 0, pICMS: 0, vICMS: 0, cst: '060' });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC01')).toBe(false);
    });
  });

  describe('BC02 — BC reduzida sem declaração', () => {
    it('emite INFO quando BC muito menor que vProd sem CST 20 e sem pRedBC (v3: apenas observar)', () => {
      const item = makeItem({
        vBC: 700,
        vProd: 1000,
        pICMS: 4,
        vICMS: 28,
        cst: '190',
        pRedBC: 0,
      });
      const results = validarBaseCalculo(item);
      const bc02 = results.find(r => r.regra === 'BC02');
      expect(bc02).toBeDefined();
      expect(bc02?.status).toBe('INFO');
    });

    it('não emite quando CST tributação é 20 (redução formal)', () => {
      const item = makeItem({
        vBC: 700,
        vProd: 1000,
        pICMS: 4,
        vICMS: 28,
        cst: '120',
        cstOrig: '1',
        pRedBC: 30,
      });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC02')).toBe(false);
    });

    it('não emite quando pRedBC > 0', () => {
      const item = makeItem({
        vBC: 700,
        vProd: 1000,
        pICMS: 4,
        vICMS: 28,
        cst: '190',
        pRedBC: 30,
      });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC02')).toBe(false);
    });

    it('não emite para CST 60 (ST retido — sem ICMS próprio)', () => {
      const item = makeItem({
        vBC: 0,
        vProd: 1000,
        pICMS: 0,
        vICMS: 0,
        cst: '060',
        cstOrig: '0',
      });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC02')).toBe(false);
    });

    it('não emite quando BC ≈ vProd (diferença < 2%)', () => {
      const item = makeItem({ vBC: 990, vProd: 1000, pICMS: 4, vICMS: 39.6 });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC02')).toBe(false);
    });
  });

  describe('BC03 — desconto reduzindo BC', () => {
    it('emite INFO quando vBC = vProd - vDesc', () => {
      const item = makeItem({
        vBC: 800,
        vProd: 1000,
        vDesc: 200,
        pICMS: 4,
        vICMS: 32,
        cst: '190',
      });
      const results = validarBaseCalculo(item);
      const bc03 = results.find(r => r.regra === 'BC03');
      expect(bc03).toBeDefined();
      expect(bc03?.status).toBe('INFO');
      // E não deve emitir BC02 para o mesmo item
      expect(results.some(r => r.regra === 'BC02')).toBe(false);
    });

    it('emite BC02 (não BC03) quando desconto não explica a redução', () => {
      const item = makeItem({
        vBC: 500,
        vProd: 1000,
        vDesc: 100, // 1000 - 100 = 900 ≠ 500
        pICMS: 4,
        vICMS: 20,
        cst: '190',
      });
      const results = validarBaseCalculo(item);
      expect(results.some(r => r.regra === 'BC03')).toBe(false);
      expect(results.some(r => r.regra === 'BC02')).toBe(true);
    });
  });

  describe('isBcConsistente', () => {
    it('true quando não há BC01', () => {
      expect(isBcConsistente([])).toBe(true);
      expect(isBcConsistente([{ status: 'AVISO', mensagem: '', regra: 'BC02' }])).toBe(true);
    });

    it('false quando há BC01', () => {
      expect(isBcConsistente([{ status: 'ERRO', mensagem: '', regra: 'BC01' }])).toBe(false);
    });
  });
});
