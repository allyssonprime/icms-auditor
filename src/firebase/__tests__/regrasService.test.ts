import { describe, it, expect, vi } from 'vitest';

// Mock Firebase before any imports that pull it in
vi.mock('firebase/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));
vi.mock('../config.ts', () => ({ db: {} }));

import { mergeGrupos } from '../regrasService.ts';
import type { GrupoRegra } from '../../types/regras.ts';

function makeValoresBase() {
  return {
    aliquotasAceitas: [17, 25] as number[],
    cargaEfetiva: 3.6,
    fundos: 0.4,
    cstEsperado: ['00'],
    cfopsEsperados: ['5101'],
    temCP: true,
    temDiferimentoParcial: false,
    refTTD: '1.2',
  };
}

function makeGrupo(id: string, overrides: Partial<GrupoRegra> = {}): GrupoRegra {
  return {
    id,
    nome: `Grupo ${id}`,
    descricao: '',
    prioridade: 1,
    ativo: true,
    condicoes: { operacao: 'interna' as const, tipoDest: ['pj_nc'] as const },
    valoresBase: makeValoresBase(),
    ramificacoes: [{ cenarioId: 'TEST', nome: 'Teste', prioridade: 1 }],
    ...overrides,
  };
}

describe('mergeGrupos', () => {
  it('usa versao Firestore quando grupo tem apenas branch catch-all (sem condicaoExtra)', () => {
    const firestoreGrupo = makeGrupo('G-PJNC', {
      condicoes: { operacao: 'interna', tipoDest: ['pj_nc'] },
      valoresBase: { ...makeValoresBase(), aliquotasAceitas: [17, 25] },
      ramificacoes: [
        { cenarioId: 'B6', nome: 'PJ NC', prioridade: 1 }, // sem condicaoExtra
      ],
    });

    const defaultGrupo = makeGrupo('G-PJNC', {
      condicoes: { operacao: 'interna', tipoDest: ['pj_nc'] },
      valoresBase: { ...makeValoresBase(), aliquotasAceitas: [7, 8.80, 12, 17, 25] },
      ramificacoes: [
        { cenarioId: 'B6', nome: 'Revenda', prioridade: 1, condicaoExtra: { aplicacao: 'revenda' as const }, override: { aliquotasAceitas: [12] } },
        { cenarioId: 'B6', nome: 'Catch-all', prioridade: 2 },
      ],
    });

    const result = mergeGrupos([firestoreGrupo], [defaultGrupo]);
    const grupo = result.find(g => g.id === 'G-PJNC')!;

    // Deve usar versao do Firestore (customizacao do usuario)
    expect(grupo.valoresBase.aliquotasAceitas).toEqual([17, 25]);
    expect(grupo.ramificacoes).toHaveLength(1);
    expect(grupo.ramificacoes[0].condicaoExtra).toBeUndefined();
  });

  it('substitui grupo com chaves de condicoes incompativeis pelo default', () => {
    const firestoreGrupo = makeGrupo('G-TEST', {
      condicoes: { operacao: 'interna' }, // sem tipoDest
      valoresBase: { ...makeValoresBase(), aliquotasAceitas: [99] },
    });
    const defaultGrupo = makeGrupo('G-TEST', {
      condicoes: { operacao: 'interna', tipoDest: ['contribuinte'] }, // com tipoDest
      valoresBase: { ...makeValoresBase(), aliquotasAceitas: [4] },
    });

    const result = mergeGrupos([firestoreGrupo], [defaultGrupo]);
    const grupo = result.find(g => g.id === 'G-TEST')!;

    // Deve usar default pois chaves de condicoes divergem (schema mudou)
    expect(grupo.valoresBase.aliquotasAceitas).toEqual([4]);
  });

  it('adiciona grupo ausente do Firestore a partir do default', () => {
    const defaultGrupo = makeGrupo('G-NOVO');
    const result = mergeGrupos([], [defaultGrupo]);
    expect(result.find(g => g.id === 'G-NOVO')).toBeDefined();
  });

  it('nao re-adiciona grupo default quando esta em deletedIds (respeitar exclusao)', () => {
    const defaultA = makeGrupo('G-TRANSF-INTERNA');
    const defaultB = makeGrupo('G-OUTRO');
    const result = mergeGrupos([defaultB], [defaultA, defaultB], ['G-TRANSF-INTERNA']);
    expect(result.find(g => g.id === 'G-TRANSF-INTERNA')).toBeUndefined();
    expect(result.find(g => g.id === 'G-OUTRO')).toBeDefined();
  });

  it('preserva grupo do Firestore com condicaoExtra quando igual ao default', () => {
    const firestoreGrupo = makeGrupo('G-CONTRIB', {
      condicoes: { operacao: 'interna', tipoDest: ['contribuinte'] },
      valoresBase: { ...makeValoresBase(), aliquotasAceitas: [4] },
      ramificacoes: [
        { cenarioId: 'B1', nome: 'Padrao', prioridade: 1, condicaoExtra: { camex: false as const } },
      ],
    });
    const defaultGrupo = makeGrupo('G-CONTRIB', {
      condicoes: { operacao: 'interna', tipoDest: ['contribuinte'] },
      valoresBase: { ...makeValoresBase(), aliquotasAceitas: [4] },
      ramificacoes: [
        { cenarioId: 'B1', nome: 'Padrao Default', prioridade: 1, condicaoExtra: { camex: false as const } },
      ],
    });

    const result = mergeGrupos([firestoreGrupo], [defaultGrupo]);
    const grupo = result.find(g => g.id === 'G-CONTRIB')!;

    // Deve usar Firestore (tem condicaoExtra, schema compativel)
    expect(grupo.ramificacoes[0].nome).toBe('Padrao');
  });
});
