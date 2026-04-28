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
        // v3.2: carga 2,1% e o PADRAO CAMEX interestadual (nao 3,6%). Ref TTD 1.2.c
        override: { aliquotasAceitas: [12, 7], cargaEfetiva: 2.1, refTTD: '1.2.b.2 + 1.2.c' },
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
      // v3.2: [17] primaria + 25 como alternativa (supperfluos). 7%/12% removidos (nao sao padrao NC interna)
      aliquotasAceitas: [17, 25],
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
        cenarioId: 'B6-CAMEX',
        nome: 'PJ Nao Contribuinte — com CAMEX',
        prioridade: 1,
        condicaoExtra: { camex: true },
        // v3.2: CAMEX NC primaria 17, alternativas 12 e 25
        override: { aliquotasAceitas: [17, 12, 25], refTTD: '1.2.b.1 + 1.14.b' },
      },
      {
        cenarioId: 'B6',
        nome: 'PJ Nao Contribuinte',
        prioridade: 2,
        // sem condicaoExtra = catch-all (sem CAMEX): simulador e auditor usam [17, 25]
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
      // v3.2: B4-CAMEX split por aplicacao
      {
        cenarioId: 'B4CX-revenda',
        nome: 'CAMEX + Revenda',
        prioridade: 2,
        condicaoExtra: { camex: true, aplicacao: 'revenda' },
        override: { aliquotasAceitas: [12], cargaEfetiva: 3.6, refTTD: '1.2.b.2' },
      },
      {
        cenarioId: 'B4CX-industrializacao',
        nome: 'CAMEX + Industrializacao',
        prioridade: 2,
        condicaoExtra: { camex: true, aplicacao: 'industrializacao' },
        override: { aliquotasAceitas: [12], cargaEfetiva: 3.6, refTTD: '1.2.b.2' },
      },
      {
        cenarioId: 'B4CX-uso',
        nome: 'CAMEX + Uso/Consumo',
        prioridade: 2,
        condicaoExtra: { camex: true, aplicacao: 'uso_consumo' },
        override: { aliquotasAceitas: [17], cargaEfetiva: 3.6, refTTD: '1.2.b.2' },
      },
      {
        cenarioId: 'B4CX-ativo',
        nome: 'CAMEX + Ativo Permanente',
        prioridade: 2,
        condicaoExtra: { camex: true, aplicacao: 'ativo_permanente' },
        override: { aliquotasAceitas: [17], cargaEfetiva: 3.6, refTTD: '1.2.b.2' },
      },
      {
        cenarioId: 'B4-CAMEX',
        nome: 'Com CAMEX (catch-all)',
        prioridade: 3,
        condicaoExtra: { camex: true },
        // v3.2 catch-all: aceita [12, 17, 25] quando aplicacao indeterminada
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
      // v3.2: primaria 17, alternativas 12 e 25 — catch-all aceita todas
      aliquotasAceitas: [17, 12, 25],
      cargaEfetiva: 3.6,
      fundos: 0.4,
      cstEsperado: ['00'],
      cfopsEsperados: ['5101', '5102', '5106', '5107'],
      temCP: true,
      temDiferimentoParcial: false,
      refTTD: '1.14.a',
    },
    ramificacoes: [
      {
        cenarioId: 'B5-revenda',
        nome: 'Simples Nacional sem ST — Revenda',
        prioridade: 1,
        condicaoExtra: { aplicacao: 'revenda' },
        override: { aliquotasAceitas: [12] },
      },
      {
        cenarioId: 'B5-industrializacao',
        nome: 'Simples Nacional sem ST — Industrializacao',
        prioridade: 2,
        condicaoExtra: { aplicacao: 'industrializacao' },
        override: { aliquotasAceitas: [12] },
      },
      {
        cenarioId: 'B5-uso',
        nome: 'Simples Nacional sem ST — Uso/Consumo',
        prioridade: 3,
        condicaoExtra: { aplicacao: 'uso_consumo' },
        override: { aliquotasAceitas: [17] },
      },
      {
        cenarioId: 'B5-ativo',
        nome: 'Simples Nacional sem ST — Ativo Permanente',
        prioridade: 4,
        condicaoExtra: { aplicacao: 'ativo_permanente' },
        override: { aliquotasAceitas: [17] },
      },
      {
        cenarioId: 'B5',
        nome: 'Simples Nacional sem ST (catch-all)',
        prioridade: 5,
        // sem condicaoExtra = catch-all: auditor e simulador geral usam [17, 12, 25]
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
      // v3.2: Industrial split por aplicacao.
      // - Revenda/Uso/Ativo: apenas [4] (4% padrao)
      // - Industrializacao: [4, 10] — 10% so para MP com mudanca NCM
      // - Catch-all (auditor sem aplicacao): [4] — default seguro.
      //   Items industriais a 10% sao flagados como ERRO pelo auditor (v3.2 strict).
      //   O recolhimento de items a 10% nao muda (cargaEfetiva fallback 3,6%).
      {
        cenarioId: 'B3-revenda',
        nome: 'Industrial (revenda)',
        prioridade: 3,
        condicaoExtra: { camex: false, listaEspecial: 'industrial', aplicacao: 'revenda' },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a' },
      },
      {
        cenarioId: 'B3-industrializacao',
        nome: 'Industrial (industrializacao — MP c/ mudanca NCM)',
        prioridade: 3,
        condicaoExtra: { camex: false, listaEspecial: 'industrial', aplicacao: 'industrializacao' },
        override: { aliquotasAceitas: [4, 10], cargaEfetiva: 3.6, refTTD: '1.2.a + 1.2.e' },
      },
      {
        cenarioId: 'B3-uso',
        nome: 'Industrial (uso/consumo)',
        prioridade: 3,
        condicaoExtra: { camex: false, listaEspecial: 'industrial', aplicacao: 'uso_consumo' },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a' },
      },
      {
        cenarioId: 'B3-ativo',
        nome: 'Industrial (ativo permanente)',
        prioridade: 3,
        condicaoExtra: { camex: false, listaEspecial: 'industrial', aplicacao: 'ativo_permanente' },
        override: { aliquotasAceitas: [4], cargaEfetiva: 1.0, refTTD: '1.2.a' },
      },
      {
        cenarioId: 'B3',
        nome: 'Industrial (geral — catch-all)',
        prioridade: 4,
        condicaoExtra: { camex: false, listaEspecial: 'industrial' },
        // v3.2 ajuste: catch-all industrial aceita [4, 10] porque nao sabemos se a
        // compra e revenda (4%) ou industrializacao (4% ou 10%). Rejeitar 10% sem
        // conhecer aplicacao seria falso positivo. cargaEfetiva=3.6 garante que
        // items a 10% recolhem 3,6%; items a 4% recolhem 1,0% via regra absoluta.
        override: { aliquotasAceitas: [4, 10], cargaEfetiva: 3.6, refTTD: '1.2.a + 1.2.e' },
      },
      {
        cenarioId: 'B1',
        nome: 'Padrao (sem CAMEX)',
        prioridade: 5,
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
    mensagemErro: 'NCM {ncm} consta no Decreto 2.128/2009. TTD não se aplica.',
    regra: 'V01',
    ativo: true,
    excecao: {
      descricao: 'Operacao interna SC×SC com aliquota cheia (>=10%) — possivel autorizacao especifica no regime',
      mensagemAlerta: 'NCM {ncm} consta no Decreto 2.128/2009, porém operação interna SC a {aliq}%. Verificar se há autorização específica no TTD (ex: apuração de CP mensal).',
      regraExcecao: 'V01-EXC',
    },
  },
  {
    id: 'V02',
    nome: 'Mercadoria usada',
    tipo: 'cfop_exato',
    fonte: 'inline',
    valores: ['5922', '6922'],
    mensagemErro: 'TTD vedado para mercadoria usada (CFOP {cfop}).',
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

// --- RegrasConfig completa (constante frozen — source of truth) ---

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val as object);
    }
  }
  return Object.freeze(obj);
}

export const REGRAS: Readonly<RegrasConfig> = deepFreeze({
  grupos: GRUPOS_DEFAULT,
  vedacoes: VEDACOES_DEFAULT,
  global: GLOBAL_DEFAULT,
});

export const REGRAS_VERSION = '3.0';

/** @deprecated Use REGRAS diretamente */
export function getDefaultRegras(): RegrasConfig {
  return REGRAS as RegrasConfig;
}
