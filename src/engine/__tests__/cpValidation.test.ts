import { describe, it, expect } from 'vitest';
import { validarCreditoPresumido } from '../cpValidation.ts';
import { makeItem } from './fixtures.ts';
import type { CenarioConfig } from '../../types/cenario.ts';

const CENARIO_COM_CP: CenarioConfig = {
  id: 'A1',
  nome: 'Interestadual PJ contribuinte (teste)',
  aliquotasAceitas: [4],
  cargaEfetiva: 1.0,
  fundos: 0.4,
  cstEsperado: ['190', '090'],
  cfopsEsperados: ['6101', '6102'],
  temCP: true,
  temDiferimentoParcial: false,
  refTTD: '1.2.a',
};

const CENARIO_SEM_CP: CenarioConfig = {
  id: 'B7',
  nome: 'Interna PF (teste)',
  aliquotasAceitas: [17],
  cargaEfetiva: -1,
  fundos: 0,
  cstEsperado: ['100', '000'],
  cfopsEsperados: ['5102'],
  temCP: false,
  temDiferimentoParcial: false,
  refTTD: 'integral',
};

describe('validarCreditoPresumido', () => {
  describe('CP01 — CP esperado, ausente', () => {
    it('emite AVISO quando cenário tem temCP=true mas XML não traz cCredPresumido', () => {
      const item = makeItem({ pICMS: 4, vBC: 1000, vICMS: 40, cCredPresumido: '' });
      const results = validarCreditoPresumido(item, CENARIO_COM_CP);
      const cp01 = results.find(r => r.regra === 'CP01');
      expect(cp01).toBeDefined();
      expect(cp01?.status).toBe('AVISO');
    });
  });

  describe('CP02 — CP presente, não esperado (ERRO)', () => {
    it('emite ERRO quando cenário tem temCP=false mas XML traz cCredPresumido', () => {
      const item = makeItem({
        pICMS: 17, vBC: 1000, vICMS: 170,
        cCredPresumido: 'SC850065', pCredPresumido: 10, vCredPresumido: 100,
      });
      const results = validarCreditoPresumido(item, CENARIO_SEM_CP);
      const cp02 = results.find(r => r.regra === 'CP02');
      expect(cp02).toBeDefined();
      expect(cp02?.status).toBe('ERRO');
    });

    it('não emite CP01 quando o cenário não espera CP', () => {
      const item = makeItem({ pICMS: 17, vBC: 1000, vICMS: 170, cCredPresumido: '' });
      const results = validarCreditoPresumido(item, CENARIO_SEM_CP);
      expect(results.some(r => r.regra === 'CP01')).toBe(false);
    });
  });

  describe('CP03 — código CP diferente do esperado', () => {
    it('emite AVISO quando cCredPresumido ≠ SC850065 em cenário com CP', () => {
      const item = makeItem({
        pICMS: 4, vBC: 1000, vICMS: 40,
        cCredPresumido: 'SC999999', pCredPresumido: 3, vCredPresumido: 30,
      });
      const results = validarCreditoPresumido(item, CENARIO_COM_CP);
      const cp03 = results.find(r => r.regra === 'CP03');
      expect(cp03).toBeDefined();
      expect(cp03?.status).toBe('AVISO');
      expect(cp03?.mensagem).toContain('SC999999');
      expect(cp03?.mensagem).toContain('SC850065');
    });

    it('NÃO emite CP03 quando cCredPresumido = SC850065', () => {
      const item = makeItem({
        pICMS: 4, vBC: 1000, vICMS: 40,
        cCredPresumido: 'SC850065', pCredPresumido: 3, vCredPresumido: 30,
      });
      const results = validarCreditoPresumido(item, CENARIO_COM_CP);
      expect(results.some(r => r.regra === 'CP03')).toBe(false);
    });

    it('NÃO emite CP03 em cenário sem CP (CP02 já trata)', () => {
      const item = makeItem({
        pICMS: 17, vBC: 1000, vICMS: 170,
        cCredPresumido: 'SC999999',
      });
      const results = validarCreditoPresumido(item, CENARIO_SEM_CP);
      expect(results.some(r => r.regra === 'CP03')).toBe(false);
      // CP02 deve disparar ERRO
      expect(results.some(r => r.regra === 'CP02' && r.status === 'ERRO')).toBe(true);
    });
  });

  describe('caso limpo', () => {
    it('não emite nenhum resultado quando tudo bate (aliq 4%, CP=SC850065)', () => {
      const item = makeItem({
        pICMS: 4, vBC: 1000, vICMS: 40,
        cCredPresumido: 'SC850065', pCredPresumido: 3, vCredPresumido: 30,
      });
      const results = validarCreditoPresumido(item, CENARIO_COM_CP);
      expect(results).toHaveLength(0);
    });
  });
});
