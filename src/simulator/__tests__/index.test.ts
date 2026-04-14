import { describe, it, expect } from 'vitest';
import { simular } from '../index.ts';
import type { SimuladorParams } from '../index.ts';
import type { AppConfig } from '../../types/config.ts';
import type { RegrasConfig } from '../../types/regras.ts';

function makeAppConfig(): AppConfig {
  return {
    decreto2128: [],
    listaCamex: [],
    listaCobreAco: [],
    listaSN: [],
    listaIndustriais: [],
    listaCD: [],
    listaVedacao25a: [],
    listaVedacao25b: [],
    ufAliquotas: {},
    aliquotasInternasValidas: [12, 17],
  };
}

function makeRegrasComPF(): RegrasConfig {
  return {
    grupos: [
      {
        id: 'G-PF-INTER',
        nome: 'PF Interestadual',
        descricao: 'Pessoa física fora de SC',
        prioridade: 1,
        ativo: true,
        condicoes: { operacao: 'interestadual', tipoDest: ['pf'] },
        valoresBase: {
          aliquotasAceitas: [4],
          cargaEfetiva: -1,
          fundos: 0,
          cstEsperado: ['000'],
          cfopsEsperados: ['6102'],
          temCP: false,
          temDiferimentoParcial: false,
          refTTD: '',
        },
        ramificacoes: [{ cenarioId: 'PF-INTER-TEST', nome: 'PF Interestadual Teste', prioridade: 1 }],
      },
    ],
    vedacoes: [],
    global: {
      ufAliquotas: {},
      aliquotasInternasValidas: [12, 17],
      cfopsDevolucao: ['5201', '6201'],
      cfopsTransferencia: ['5152', '6152'],
      fundosPadrao: 0.4,
    },
  };
}

describe('gerarObservacoes via simular()', () => {
  it('observacoes refletem config da branch resolvida, nao mapa flat', () => {
    // Grupo com branch revenda ([12]) e catch-all ([17, 25])
    // Simulando sem aplicacao → deve resolver catch-all
    const regras: RegrasConfig = {
      grupos: [{
        id: 'G-PJNC',
        nome: 'PJ NC',
        descricao: '',
        prioridade: 1,
        ativo: true,
        condicoes: { operacao: 'interna', tipoDest: ['pj_nc'] },
        valoresBase: {
          aliquotasAceitas: [17, 25],
          cargaEfetiva: 3.6,
          fundos: 0.4,
          cstEsperado: ['00'],
          cfopsEsperados: ['5101'],
          temCP: true,
          temDiferimentoParcial: false,
          refTTD: '1.2',
        },
        ramificacoes: [
          {
            cenarioId: 'B6',
            nome: 'Revenda',
            prioridade: 1,
            condicaoExtra: { aplicacao: 'revenda' },
            override: { aliquotasAceitas: [12] },
          },
          {
            cenarioId: 'B6',
            nome: 'PJ NC Catch-all',
            prioridade: 2,
          },
        ],
      }],
      vedacoes: [],
      global: {
        ufAliquotas: {},
        aliquotasInternasValidas: [17, 25],
        cfopsDevolucao: [],
        cfopsTransferencia: [],
        fundosPadrao: 0.004,
      },
    };

    const params: SimuladorParams = {
      destUf: 'SC',
      destRegime: 'nao_contribuinte',
      ncm: '8471.30.19',
      valorOperacao: 1000,
      // aplicacao: undefined → catch-all
    };

    const result = simular(params, makeAppConfig(), regras);
    // Deve resolver B6 catch-all com [17, 25], nao branch revenda [12]
    expect(result.cenarioClassificado).toBe('B6');
    expect(result.aliquotaDestacada).toBe(17); // escolherAliquotaDefault([17, 25]) → 17
  });
});

describe('simular()', () => {
  it('classifica PF interestadual pelo cenario definido em regras, nao pelo ID hardcoded', () => {
    const params: SimuladorParams = {
      destUf: 'SP',
      destRegime: 'nao_contribuinte',
      isPessoaFisica: true,
      ncm: '8471.30.19',
      valorOperacao: 1000,
    };
    const result = simular(params, makeAppConfig(), makeRegrasComPF());
    expect(result.cenarioClassificado).toBe('PF-INTER-TEST');
  });

  it('PF interestadual com cargaEfetiva -1 retorna creditoPresumido zero', () => {
    const params: SimuladorParams = {
      destUf: 'SP',
      destRegime: 'nao_contribuinte',
      isPessoaFisica: true,
      ncm: '8471.30.19',
      valorOperacao: 1000,
    };
    const result = simular(params, makeAppConfig(), makeRegrasComPF());
    expect(result.creditoPresumido).toBe(0);
  });

  it('retorna DESCONHECIDO quando nenhum grupo casa', () => {
    const params: SimuladorParams = {
      destUf: 'SP',
      destRegime: 'normal',
      isPessoaFisica: false,
      ncm: '8471.30.19',
      valorOperacao: 1000,
    };
    const regras: RegrasConfig = {
      grupos: [],
      vedacoes: [],
      global: {
        ufAliquotas: {},
        aliquotasInternasValidas: [],
        cfopsDevolucao: [],
        cfopsTransferencia: [],
        fundosPadrao: 0,
      },
    };
    const result = simular(params, makeAppConfig(), regras);
    expect(result.cenarioClassificado).toBe('DESCONHECIDO');
  });
});
