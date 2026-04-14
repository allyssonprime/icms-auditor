import { describe, it, expect } from 'vitest';
import { getCenarios } from '../cenarios.ts';
import type { RegrasConfig } from '../../types/regras.ts';

function makeGlobal() {
  return {
    ufAliquotas: {} as Record<string, number>,
    aliquotasInternasValidas: [] as number[],
    cfopsDevolucao: [] as string[],
    cfopsTransferencia: [] as string[],
    fundosPadrao: 0,
  };
}

function makeValoresBase(aliquotasAceitas: number[]) {
  return {
    aliquotasAceitas,
    cargaEfetiva: 3.6,
    fundos: 0.4,
    cstEsperado: ['00'],
    cfopsEsperados: ['5101'],
    temCP: true,
    temDiferimentoParcial: false,
    refTTD: '',
  };
}

describe('getCenarios', () => {
  it('prefere branch catch-all (sem condicaoExtra) como canonica quando multiplas branches compartilham cenarioId', () => {
    const regras: RegrasConfig = {
      grupos: [{
        id: 'G-TEST',
        nome: 'Teste',
        descricao: '',
        prioridade: 1,
        ativo: true,
        condicoes: { operacao: 'interna', tipoDest: ['pj_nc'] },
        valoresBase: makeValoresBase([17, 25]),
        ramificacoes: [
          {
            cenarioId: 'B6',
            nome: 'Catch-all',
            prioridade: 1,
            // sem condicaoExtra
          },
          {
            cenarioId: 'B6',
            nome: 'Revenda',
            prioridade: 2,
            condicaoExtra: { aplicacao: 'revenda' as const },
            override: { aliquotasAceitas: [12] },
          },
        ],
      }],
      vedacoes: [],
      global: makeGlobal(),
    };

    const mapa = getCenarios(regras);
    // Deve usar catch-all (base values [17, 25]), nao a branch revenda ([12])
    expect(mapa['B6']?.aliquotasAceitas).toEqual([17, 25]);
    expect(mapa['B6']?.isCAMEX).toBe(false);
  });

  it('prefere branch catch-all mesmo quando aparece por ultimo no array', () => {
    const regras: RegrasConfig = {
      grupos: [{
        id: 'G-TEST2',
        nome: 'Teste2',
        descricao: '',
        prioridade: 1,
        ativo: true,
        condicoes: { operacao: 'interna', tipoDest: ['pj_nc'] },
        valoresBase: makeValoresBase([17, 25]),
        ramificacoes: [
          {
            cenarioId: 'B6',
            nome: 'Revenda',
            prioridade: 1,
            condicaoExtra: { aplicacao: 'revenda' as const },
            override: { aliquotasAceitas: [12] },
          },
          {
            cenarioId: 'B6',
            nome: 'Catch-all',
            prioridade: 2,
            // sem condicaoExtra
          },
        ],
      }],
      vedacoes: [],
      global: makeGlobal(),
    };

    const mapa = getCenarios(regras);
    expect(mapa['B6']?.aliquotasAceitas).toEqual([17, 25]);
  });

  it('usa a primeira branch encontrada quando nenhuma e catch-all (todas tem condicaoExtra)', () => {
    const regras: RegrasConfig = {
      grupos: [{
        id: 'G-TEST3',
        nome: 'Teste3',
        descricao: '',
        prioridade: 1,
        ativo: true,
        condicoes: { operacao: 'interna', tipoDest: ['contribuinte'] },
        valoresBase: makeValoresBase([4]),
        ramificacoes: [
          {
            cenarioId: 'B1',
            nome: 'Com CAMEX',
            prioridade: 1,
            condicaoExtra: { camex: true as const },
            override: { aliquotasAceitas: [7, 12] },
          },
          {
            cenarioId: 'B1',
            nome: 'Sem CAMEX',
            prioridade: 2,
            condicaoExtra: { camex: false as const },
            override: { aliquotasAceitas: [4] },
          },
        ],
      }],
      vedacoes: [],
      global: makeGlobal(),
    };

    const mapa = getCenarios(regras);
    // Quando nenhuma branch e catch-all, a primeira encontrada e preservada
    expect(mapa['B1']?.aliquotasAceitas).toEqual([7, 12]);
  });

  it('nao inclui grupos inativos', () => {
    const regras: RegrasConfig = {
      grupos: [{
        id: 'G-INATIVO',
        nome: 'Inativo',
        descricao: '',
        prioridade: 1,
        ativo: false,
        condicoes: {},
        valoresBase: makeValoresBase([17]),
        ramificacoes: [{ cenarioId: 'X1', nome: 'X', prioridade: 1 }],
      }],
      vedacoes: [],
      global: makeGlobal(),
    };

    const mapa = getCenarios(regras);
    expect(mapa['X1']).toBeUndefined();
  });
});
