import type { RegrasConfig, GrupoRegra, VedacaoRule, RegrasGlobal } from '../types/regras.ts';

// ===== Valores padrao que reproduzem exatamente o comportamento hardcoded atual =====

const GRUPOS_DEFAULT: GrupoRegra[] = [
  // DEVOLUCAO nao e configuravel — tratamento especial no validator.ts (alerta fixo I09)

  // --- Grupo 1: Transferencia Interestadual (prio 2) ---
  {
    id: 'G-TRANSF-INTER',
    nome: 'Transferencia interestadual',
    descricao: 'Transferencia entre filiais (interestadual)',
    prioridade: 2,
    ativo: true,
    condicoes: { operacao: 'interestadual', cfopMatch: 'transferencia' },
    valoresBase: {
      aliquotasAceitas: [4, 12, 7],
      cargaEfetiva: 1.0,
      fundos: 0.4,
      cstEsperado: ['90'],
      cfopsEsperados: ['6152', '6155'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '1.6',
    },
    ramificacoes: [
      { cenarioId: 'A9', nome: 'Transferencia interestadual (filial)', prioridade: 1 },
    ],
  },

  // --- Grupo 3: Transferencia Interna (prio 3) ---
  {
    id: 'G-TRANSF-INTERNA',
    nome: 'Transferencia interna',
    descricao: 'Transferencia entre filiais SC',
    prioridade: 3,
    ativo: true,
    condicoes: { operacao: 'interna', cfopMatch: 'transferencia' },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: -1,
      fundos: 0,
      cstEsperado: ['51'],
      cfopsEsperados: ['5152', '5155'],
      temCP: false,
      temDiferimentoParcial: false,
      refTTD: '2.1.c.2',
    },
    ramificacoes: [
      { cenarioId: 'B12', nome: 'Transferencia interna (filial SC)', prioridade: 1 },
    ],
  },

  // --- Grupo 4: Interestadual PJ NC (prio 10) ---
  {
    id: 'G-INTER-PJNC',
    nome: 'Interestadual — PJ Nao Contribuinte',
    descricao: 'Operacoes interestaduais para PJ sem inscricao estadual',
    prioridade: 10,
    ativo: true,
    condicoes: { operacao: 'interestadual', tipoDest: ['pj_nc'] },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: 0,
      fundos: 0.4,
      cstEsperado: ['90'],
      cfopsEsperados: ['6101', '6102', '6107', '6108'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '',
    },
    ramificacoes: [
      {
        cenarioId: 'A4',
        nome: 'Sem CAMEX',
        prioridade: 1,
        condicaoExtra: { camex: false },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a + 1.25' },
      },
      {
        cenarioId: 'A5',
        nome: 'Com CAMEX',
        prioridade: 2,
        condicaoExtra: { camex: true },
        override: { aliquotasAceitas: [12, 7], cargaEfetiva: 3.6, refTTD: '1.2.b.3' },
      },
    ],
  },

  // --- Grupo 5: Interestadual PF (prio 12) ---
  {
    id: 'G-INTER-PF',
    nome: 'Interestadual — Pessoa Fisica',
    descricao: 'Operacoes interestaduais para pessoa fisica de outra UF',
    prioridade: 12,
    ativo: true,
    condicoes: { operacao: 'interestadual', tipoDest: ['pf'] },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: 0,
      fundos: 0.4,
      cstEsperado: ['90'],
      cfopsEsperados: ['6101', '6102', '6107', '6108'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '',
    },
    ramificacoes: [
      {
        cenarioId: 'A6',
        nome: 'Sem CAMEX',
        prioridade: 1,
        condicaoExtra: { camex: false },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a + 1.25' },
      },
      {
        cenarioId: 'A7',
        nome: 'Com CAMEX',
        prioridade: 2,
        condicaoExtra: { camex: true },
        override: { aliquotasAceitas: [12, 7], cargaEfetiva: 3.6, refTTD: '1.2.b.3' },
      },
    ],
  },

  // --- Grupo 6: Interestadual Cobre/Aco (prio 14) ---
  {
    id: 'G-INTER-COBREACO',
    nome: 'Interestadual — Cobre/Aco',
    descricao: 'Desativado v3: cobre/aco e modificador (M01), nao cenario separado',
    prioridade: 14,
    ativo: false,
    condicoes: { operacao: 'interestadual', tipoDest: ['contribuinte'], camex: false, cobreAco: true },
    valoresBase: {
      aliquotasAceitas: [4],
      cargaEfetiva: 0.6,
      fundos: 0.4,
      cstEsperado: ['90'],
      cfopsEsperados: ['6101', '6102', '6106', '6107'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '1.2.a.1',
    },
    ramificacoes: [
      { cenarioId: 'A8', nome: 'Cobre/Aco — Contribuinte', prioridade: 1 },
    ],
  },

  // --- Grupo 7: Interestadual Contribuinte/SN (prio 15) ---
  {
    id: 'G-INTER-CONTRIB',
    nome: 'Interestadual — Contribuinte / SN',
    descricao: 'Contribuinte normal ou Simples Nacional interestadual',
    prioridade: 15,
    ativo: true,
    condicoes: { operacao: 'interestadual', tipoDest: ['contribuinte', 'sn'] },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: 0,
      fundos: 0.4,
      cstEsperado: ['90'],
      cfopsEsperados: ['6101', '6102', '6106', '6107'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '',
    },
    ramificacoes: [
      {
        cenarioId: 'A2',
        nome: 'Com CAMEX',
        prioridade: 1,
        condicaoExtra: { camex: true },
        override: { aliquotasAceitas: [12, 7], cargaEfetiva: 3.6, refTTD: '1.2.b.2' },
      },
      {
        cenarioId: 'A1',
        nome: 'Sem CAMEX',
        prioridade: 2,
        condicaoExtra: { camex: false },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a.2' },
      },
    ],
  },

  // --- Grupo 8: Interna Vedacao 25a (prio 20) ---
  {
    id: 'G-INTERNA-VED25A',
    nome: 'Interna — Vedacao 25a (Pro-Emprego)',
    descricao: 'Destinatario com TTD/diferimento Pro-Emprego',
    prioridade: 20,
    ativo: true,
    condicoes: { operacao: 'interna', listaEspecial: 'vedacao25a' },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: 0,
      fundos: 0,
      cstEsperado: ['51'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: false,
      temDiferimentoParcial: true,
      refTTD: '1.14.d + 2.5.a',
    },
    ramificacoes: [
      { cenarioId: 'B9', nome: 'Dest. com TTD/diferimento (Pro-Emprego)', prioridade: 1 },
    ],
  },

  // --- Grupo 9: Interna Vedacao 25b / Textil (prio 21) ---
  {
    id: 'G-INTERNA-VED25B',
    nome: 'Interna — Textil/Confeccoes',
    descricao: 'Destinatario textil/confeccoes (art.15 XXXIX)',
    prioridade: 21,
    ativo: true,
    condicoes: { operacao: 'interna', listaEspecial: 'vedacao25b' },
    valoresBase: {
      aliquotasAceitas: [10],
      cargaEfetiva: 3.6,
      fundos: 0.4,
      cstEsperado: ['51'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: true,
      refTTD: '2.5.b',
    },
    ramificacoes: [
      { cenarioId: 'B10', nome: 'Dest. textil/confeccoes (art.15 XXXIX)', prioridade: 1 },
    ],
  },

  // --- Grupo 10: Interna CD Exclusivo (prio 22) ---
  {
    id: 'G-INTERNA-CD',
    nome: 'Interna — CD Exclusivo (Booster)',
    descricao: 'Centro de distribuicao exclusivo',
    prioridade: 22,
    ativo: true,
    condicoes: { operacao: 'interna', listaEspecial: 'cd' },
    valoresBase: {
      aliquotasAceitas: [10],
      cargaEfetiva: 1.0,
      fundos: 0.4,
      cstEsperado: ['51'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: true,
      refTTD: '1.26',
    },
    ramificacoes: [
      { cenarioId: 'B11', nome: 'CD Exclusivo (Booster)', prioridade: 1 },
    ],
  },

  // --- Grupo 11: Interna PF (prio 30) ---
  {
    id: 'G-INTERNA-PF',
    nome: 'Interna — Pessoa Fisica',
    descricao: 'Consumidor final pessoa fisica em SC',
    prioridade: 30,
    ativo: true,
    condicoes: { operacao: 'interna', tipoDest: ['pf'] },
    valoresBase: {
      aliquotasAceitas: [12, 17, 25],
      cargaEfetiva: -1,
      fundos: 0,
      cstEsperado: ['00'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: false,
      temDiferimentoParcial: false,
      refTTD: '2.1.c.3 + 1.14.b',
    },
    ramificacoes: [
      { cenarioId: 'B7', nome: 'Pessoa Fisica (consumidor final)', prioridade: 1 },
    ],
  },

  // --- Grupo 12: Interna PJ NC (prio 31) ---
  {
    id: 'G-INTERNA-PJNC',
    nome: 'Interna — PJ Nao Contribuinte',
    descricao: 'PJ sem inscricao estadual em SC (CAMEX nao altera valores)',
    prioridade: 31,
    ativo: true,
    condicoes: { operacao: 'interna', tipoDest: ['pj_nc'] },
    valoresBase: {
      aliquotasAceitas: [7, 12, 17, 25],
      cargaEfetiva: 3.6,
      fundos: 0.4,
      cstEsperado: ['00'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '1.2.b.1 + 1.14.b',
    },
    ramificacoes: [
      {
        cenarioId: 'B6',
        nome: 'PJ Nao Contribuinte — Revenda',
        prioridade: 1,
        condicaoExtra: { aplicacao: 'revenda' },
        override: { aliquotasAceitas: [12] },
      },
      {
        cenarioId: 'B6',
        nome: 'PJ Nao Contribuinte — Industrializacao',
        prioridade: 2,
        condicaoExtra: { aplicacao: 'industrializacao' },
        override: { aliquotasAceitas: [12] },
      },
      {
        cenarioId: 'B6-CAMEX',
        nome: 'PJ Nao Contribuinte — com CAMEX',
        prioridade: 3,
        condicaoExtra: { camex: true },
        override: { aliquotasAceitas: [12, 17, 25], refTTD: '1.14.b' },
      },
      {
        cenarioId: 'B6',
        nome: 'PJ Nao Contribuinte',
        prioridade: 4,
        // sem condicaoExtra = catch-all: simulador outros usos + auditor
      },
    ],
  },

  // --- Grupo 13: Interna SN com ST (prio 40) ---
  {
    id: 'G-INTERNA-SN-ST',
    nome: 'Interna — Simples Nacional com ST',
    descricao: 'Destinatario Simples Nacional com Substituicao Tributaria',
    prioridade: 40,
    ativo: true,
    condicoes: { operacao: 'interna', tipoDest: ['sn'], temST: true },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: 0,
      fundos: 0.4,
      cstEsperado: ['10', '70'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '',
    },
    ramificacoes: [
      {
        cenarioId: 'B4',
        nome: 'Sem CAMEX',
        prioridade: 1,
        condicaoExtra: { camex: false },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a + 1.14.a' },
      },
      {
        cenarioId: 'B4-CAMEX',
        nome: 'Com CAMEX',
        prioridade: 2,
        condicaoExtra: { camex: true },
        override: { aliquotasAceitas: [12, 17, 25], cargaEfetiva: 3.6, refTTD: '1.2.b.2' },
      },
    ],
  },

  // --- Grupo 14: Interna SN sem ST (prio 42) ---
  {
    id: 'G-INTERNA-SN-SEMST',
    nome: 'Interna — Simples Nacional sem ST',
    descricao: 'Destinatario Simples Nacional sem Substituicao Tributaria (CAMEX nao altera valores)',
    prioridade: 42,
    ativo: true,
    condicoes: { operacao: 'interna', tipoDest: ['sn'], temST: false },
    valoresBase: {
      aliquotasAceitas: [12, 17, 25],
      cargaEfetiva: 3.6,
      fundos: 0.4,
      cstEsperado: ['00'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '1.2.b.1 + 1.14.a',
    },
    ramificacoes: [
      {
        cenarioId: 'B5',
        nome: 'Simples Nacional sem ST — Revenda',
        prioridade: 1,
        condicaoExtra: { aplicacao: 'revenda' },
        override: { aliquotasAceitas: [12] },
      },
      {
        cenarioId: 'B5',
        nome: 'Simples Nacional sem ST — Industrializacao',
        prioridade: 2,
        condicaoExtra: { aplicacao: 'industrializacao' },
        override: { aliquotasAceitas: [12] },
      },
      {
        cenarioId: 'B5',
        nome: 'Simples Nacional sem ST',
        prioridade: 3,
        // sem condicaoExtra = catch-all: simulador outros usos + auditor
      },
    ],
  },

  // --- Grupo 15: Interna Contribuinte Normal (prio 50) ---
  {
    id: 'G-INTERNA-CONTRIB',
    nome: 'Interna — Contribuinte Normal',
    descricao: 'Contribuinte normal em SC (3 variantes: CAMEX, industrial, padrao)',
    prioridade: 50,
    ativo: true,
    condicoes: { operacao: 'interna', tipoDest: ['contribuinte'] },
    valoresBase: {
      aliquotasAceitas: [],
      cargaEfetiva: 0,
      fundos: 0.4,
      cstEsperado: ['51'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: true,
      refTTD: '',
    },
    ramificacoes: [
      {
        cenarioId: 'B2-Industrial',
        nome: 'CAMEX + Industrial',
        prioridade: 1,
        condicaoExtra: { camex: true, listaEspecial: 'industrial' },
        override: { aliquotasAceitas: [12], cargaEfetiva: 3.6, refTTD: '1.2.b.2 + 1.2.e + 1.13.a' },
      },
      {
        cenarioId: 'B2',
        nome: 'Com CAMEX',
        prioridade: 2,
        condicaoExtra: { camex: true },
        override: { aliquotasAceitas: [12], cargaEfetiva: 3.6, refTTD: '1.2.b.2 + 1.13.a' },
      },
      {
        cenarioId: 'B3',
        nome: 'Industrial (MP c/ mudanca NCM)',
        prioridade: 3,
        condicaoExtra: { camex: false, listaEspecial: 'industrial' },
        override: { aliquotasAceitas: [10, 4], cargaEfetiva: 3.6, refTTD: '1.2.e + 1.13.b' },
      },
      {
        cenarioId: 'B1',
        nome: 'Padrao (sem CAMEX)',
        prioridade: 4,
        condicaoExtra: { camex: false },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a + 1.13.c' },
      },
    ],
  },
];

// --- Vedacoes default ---

const VEDACOES_DEFAULT: VedacaoRule[] = [
  {
    id: 'V01',
    nome: 'Decreto 2.128 — NCMs vedadas',
    tipo: 'ncm_prefix',
    fonte: 'config',
    campoConfig: 'decreto2128',
    mensagemErro: 'NCM {ncm} vedada pelo Decreto 2.128. TTD nao pode ser aplicado.',
    regra: 'V01',
    ativo: true,
    excecao: {
      descricao: 'Operacao interna SC×SC com aliquota cheia (>=10%) — possivel autorizacao especifica no regime',
      mensagemAlerta: 'NCM {ncm} consta no Decreto 2.128 (vedado), porem operacao interna SC a {aliq}% — verificar se empresa possui autorizacao especifica no TTD para este NCM (ex.: apuracao de CP mensal).',
      regraExcecao: 'V01-EXC',
    },
  },
  {
    id: 'V02',
    nome: 'Mercadoria usada',
    tipo: 'cfop_exato',
    fonte: 'inline',
    valores: ['5922', '6922'],
    mensagemErro: 'TTD vedado para mercadoria usada.',
    regra: 'V02',
    ativo: true,
  },
];

// --- Config global default ---

const GLOBAL_DEFAULT: RegrasGlobal = {
  ufAliquotas: {
    PR: 12, RJ: 12, RS: 12, SP: 12,
    // Demais UFs = 7% (engine usa 7 como fallback)
  },
  aliquotasInternasValidas: [7, 8.80, 12, 17, 25],
  cfopsDevolucao: ['1201', '1202', '2201', '2202', '5201', '5202', '6201', '6202'],
  cfopsTransferencia: ['5152', '5155', '6152', '6155'],
  fundosPadrao: 0.004,
};

// --- RegrasConfig completa ---

export function getDefaultRegras(): RegrasConfig {
  return {
    grupos: GRUPOS_DEFAULT,
    vedacoes: VEDACOES_DEFAULT,
    global: GLOBAL_DEFAULT,
  };
}
