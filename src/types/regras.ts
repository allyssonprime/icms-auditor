// ===== Motor de Regras Configuravel =====
// Cada GrupoRegra define QUANDO se aplica (condicoes) e O QUE esperar (valores).
// Ramificacoes permitem variantes dentro do mesmo grupo (ex: com/sem CAMEX).

// --- Condicoes de classificacao ---

export type TipoDest = 'contribuinte' | 'sn' | 'pj_nc' | 'pf' | 'desconhecido';
export type TipoOperacao = 'interestadual' | 'interna';
export type CfopMatch = 'devolucao' | 'transferencia';
export type ListaEspecial = 'vedacao25a' | 'vedacao25b' | 'cd' | 'industrial';
export type AplicacaoProduto = 'revenda' | 'industrializacao' | 'uso_consumo' | 'ativo_permanente';

export interface CondicoesCenario {
  operacao?: TipoOperacao;        // undefined = qualquer
  tipoDest?: TipoDest[];          // OR: basta o dest ser um dos listados
  camex?: boolean;                // true/false/undefined=qualquer
  cobreAco?: boolean;
  temST?: boolean;
  listaEspecial?: ListaEspecial;
  cfopMatch?: CfopMatch;
  aplicacao?: AplicacaoProduto;   // undefined = qualquer aplicacao
}

// --- Valores esperados (o que a NF-e deveria ter) ---

export interface ValoresEsperados {
  aliquotasAceitas: number[];
  cargaEfetiva: number;
  fundos: number;
  cstEsperado: string[];
  cfopsEsperados: string[];
  temCP: boolean;
  temDiferimentoParcial: boolean;
  refTTD: string;
}

// --- Ramificacao (variante dentro de um grupo) ---

export interface Ramificacao {
  cenarioId: string;                          // ID unico: A1, A2, B3...
  nome: string;
  prioridade: number;                         // dentro do grupo (menor = primeiro)
  condicaoExtra?: Partial<CondicoesCenario>;  // o que diferencia esta variante
  override?: Partial<ValoresEsperados>;       // valores que sobrescrevem valoresBase
}

// --- Grupo de regras ---

export interface GrupoRegra {
  id: string;
  nome: string;
  descricao: string;
  prioridade: number;   // entre grupos (menor = avaliado primeiro)
  ativo: boolean;

  condicoes: CondicoesCenario;
  valoresBase: ValoresEsperados;
  ramificacoes: Ramificacao[];
}

// --- Vedacoes (regras bloqueantes) ---

export interface VedacaoExcecao {
  descricao: string;
  mensagemAlerta: string;
  regraExcecao: string;
}

// Condicoes para vedacao por tipo de operacao
export interface CondicaoVedacao {
  operacao?: TipoOperacao;
  cfopMatch?: CfopMatch;
  tipoDest?: TipoDest[];
  listaEspecial?: ListaEspecial;
}

export interface VedacaoRule {
  id: string;
  nome: string;
  tipo: 'ncm_prefix' | 'cfop_exato' | 'condicao_operacao';
  fonte: 'config' | 'inline';      // 'config' = le lista de AppConfig, 'inline' = usa valores[]
  campoConfig?: string;             // ex: 'decreto2128' (quando fonte='config')
  valores?: string[];               // quando fonte='inline'
  condicaoVedacao?: CondicaoVedacao; // so quando tipo = 'condicao_operacao'
  mensagemErro: string;
  regra: string;                    // codigo da regra (V01, V02)
  ativo: boolean;
  excecao?: VedacaoExcecao;
}

// --- Config global ---

export interface RegrasGlobal {
  ufAliquotas: Record<string, number>;    // UF → aliquota interestadual
  aliquotasInternasValidas: number[];
  cfopsDevolucao: string[];
  cfopsTransferencia: string[];
  fundosPadrao: number;                   // 0.004 = 0.4%
}

// --- Config completa de regras ---

export interface RegrasConfig {
  grupos: GrupoRegra[];
  vedacoes: VedacaoRule[];
  global: RegrasGlobal;
}

// --- Utility: merge de valores com override ---

export function mergeValores(base: ValoresEsperados, override?: Partial<ValoresEsperados>): ValoresEsperados {
  if (!override) return { ...base };
  return {
    aliquotasAceitas: override.aliquotasAceitas ?? base.aliquotasAceitas,
    cargaEfetiva: override.cargaEfetiva ?? base.cargaEfetiva,
    fundos: override.fundos ?? base.fundos,
    cstEsperado: override.cstEsperado ?? base.cstEsperado,
    cfopsEsperados: override.cfopsEsperados ?? base.cfopsEsperados,
    temCP: override.temCP ?? base.temCP,
    temDiferimentoParcial: override.temDiferimentoParcial ?? base.temDiferimentoParcial,
    refTTD: override.refTTD ?? base.refTTD,
  };
}

// --- Campos derivados da NF-e (computados pelo engine) ---

export interface CamposDerivados {
  operacao: TipoOperacao;
  tipoDest: TipoDest;
  isCAMEX: boolean;
  isCobreAco: boolean;
  temST: boolean;
  cfopMatch: CfopMatch | null;
  listaEspecial: ListaEspecial | null;
  aplicacao: AplicacaoProduto | null;  // null = auditoria (aceita qualquer cenario)
}
