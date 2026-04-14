# Pipeline 100% Data-Driven (Regras do Firebase) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que todo o sistema — auditoria, simulador, dashboard e exportação — use as regras configuradas pelo usuário no Firebase, sem nenhuma lógica hardcoded de classificação ou valores de cenários.

**Architecture:** A `RegrasConfig` carregada do Firebase em `App.tsx` é passada como prop por toda a cadeia de componentes. O simulador substitui sua árvore de decisão interna por chamadas a `resolverCenario()` (o mesmo motor da auditoria). `getCenarios(regras)` substitui o `CENARIOS` estático em todos os consumidores.

**Tech Stack:** React, TypeScript, Vitest — `src/engine/classifier.ts` (resolverCenario), `src/engine/cenarios.ts` (getCenarios), `src/types/regras.ts` (CamposDerivados, RegrasConfig)

---

## File Map

| Arquivo | Tipo | O que muda |
|---|---|---|
| `src/simulator/index.ts` | Modify | Remove classificação hardcoded; adiciona `buildCamposDerivadosSimulador`; usa `resolverCenario` + `getCenarios(regras)` |
| `src/simulator/__tests__/index.test.ts` | Create | Testes para o simulador data-driven |
| `src/components/SimuladorPage.tsx` | Modify | `regras` deixa de ser opcional |
| `src/components/Dashboard.tsx` | Modify | Aceita `regras` como prop; `cenariosMap` computado via `useMemo` |
| `src/components/NfeListView.tsx` | Modify | Aceita e propaga `regras` |
| `src/components/NfeCard.tsx` | Modify | Aceita e propaga `regras` |
| `src/components/ItemDetail.tsx` | Modify | Aceita `regras`; substitui `CENARIOS` estático |
| `src/components/ExportButton.tsx` | Modify | Aceita e propaga `regras` |
| `src/utils/exportExcel.ts` | Modify | Aceita `regras`; substitui `CENARIOS` estático |
| `src/App.tsx` | Modify | Passa `regras` para Dashboard, NfeListView, ExportButton |
| `src/components/regras/GrupoEditor.tsx` | Modify | Remove restrição última ramificação; adiciona tooltip nos Valores Base |

---

## Task 1: Simulator — substituir classificação hardcoded pelo motor de regras

**Files:**
- Modify: `src/simulator/index.ts`
- Modify: `src/components/SimuladorPage.tsx`
- Create: `src/simulator/__tests__/index.test.ts`

- [ ] **Step 1.1: Criar arquivo de teste e escrever testes falhando**

Criar `src/simulator/__tests__/index.test.ts`:

```typescript
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
      cenariosSemFundos: [],
    },
  };
}

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
        cenariosSemFundos: [],
      },
    };
    const result = simular(params, makeAppConfig(), regras);
    expect(result.cenarioClassificado).toBe('DESCONHECIDO');
  });
});
```

- [ ] **Step 1.2: Executar testes e confirmar que falham**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npm run test -- src/simulator/__tests__/index.test.ts
```

Esperado: FAIL — os testes falham porque `simular()` ainda usa a lógica hardcoded (retorna 'A6' em vez de 'PF-INTER-TEST').

- [ ] **Step 1.3: Reescrever `src/simulator/index.ts` com motor de regras**

Substituir o conteúdo completo do arquivo:

```typescript
import type { CenarioConfig } from '../types/cenario.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig, CamposDerivados, TipoDest, ListaEspecial } from '../types/regras.ts';
import type { ItemData, NfeData } from '../types/nfe.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { verificarVedacoes } from '../engine/vedacoes.ts';
import { resolverCenario } from '../engine/classifier.ts';
import { getCenarios } from '../engine/cenarios.ts';
import { calcularTTD } from './calculator.ts';

// ── Tipos de entrada ────────────────────────────────────────────

export type RegimeTributario = 'normal' | 'simples_nacional' | 'nao_contribuinte';
export type AplicacaoProduto = 'industrializacao' | 'uso_consumo' | 'revenda' | 'ativo_permanente';

export interface SimuladorParams {
  /** UF do destinatário (ex: "SC", "SP") */
  destUf: string;
  /** Regime tributário do destinatário */
  destRegime: RegimeTributario;
  /** CNPJ do destinatário (para lookup em listas) */
  destCnpj?: string;
  /** É pessoa física? */
  isPessoaFisica?: boolean;
  /** NCM do produto (ex: "8471.30.19") */
  ncm: string;
  /** Tipo de aplicação do item */
  aplicacao?: AplicacaoProduto;
  /** Valor da operação em R$ */
  valorOperacao: number;
  /** CST origem do item (default "1" = importação direta) */
  cstOrigem?: string;
  /** Mercadoria tem substituição tributária? */
  temST?: boolean;
  /** Produto consta na lista CAMEX? */
  isCamex?: boolean;
  /** Destinatário é industrial? */
  isIndustrial?: boolean;
}

// ── Tipo de saída ───────────────────────────────────────────────

export interface SimuladorResult {
  aliquotaDestacada: number;
  icmsDestacado: number;
  icmsRecolhimento: { valor: number; pct: number };
  fundosSociais: { valor: number; pct: number };
  totalRecolher: { valor: number; pct: number };
  creditoPresumido: number;
  cenarioClassificado: string;
  cenarioNome: string;
  refTTD: string;
  observacoes: string[];
  bcIntegral: number;
  ncm: string;
  isVedado: boolean;
  vedacaoMsg: string;
}

// ── Converter SimuladorParams em CamposDerivados ─────────────────

function buildCamposDerivadosSimulador(
  params: SimuladorParams,
  config: AppConfig,
): CamposDerivados {
  const isInterestadual = params.destUf.toUpperCase() !== 'SC';
  const isPF = params.isPessoaFisica === true;
  const isNaoContrib = !isPF && params.destRegime === 'nao_contribuinte';
  const isSN = params.destRegime === 'simples_nacional';
  const isContrib = params.destRegime === 'normal';

  let tipoDest: TipoDest = 'desconhecido';
  if (isPF) tipoDest = 'pf';
  else if (isNaoContrib) tipoDest = 'pj_nc';
  else if (isSN) tipoDest = 'sn';
  else if (isContrib) tipoDest = 'contribuinte';

  const isCAMEX = params.isCamex === true || params.cstOrigem === '6';
  const temST = params.temST === true;

  let listaEspecial: ListaEspecial | null = null;
  if (params.destCnpj) {
    if (config.listaVedacao25a.includes(params.destCnpj)) listaEspecial = 'vedacao25a';
    else if (config.listaVedacao25b.includes(params.destCnpj)) listaEspecial = 'vedacao25b';
    else if (config.listaCD.includes(params.destCnpj)) listaEspecial = 'cd';
    else if (
      params.isIndustrial === true ||
      (params.isIndustrial !== false && config.listaIndustriais.includes(params.destCnpj))
    ) listaEspecial = 'industrial';
  }

  return {
    operacao: isInterestadual ? 'interestadual' : 'interna',
    tipoDest,
    isCAMEX,
    isCobreAco: isCobreAco(params.ncm, config.listaCobreAco),
    temST,
    cfopMatch: null,
    listaEspecial,
    aplicacao: params.aplicacao ?? null,
  };
}

// ── Observações por cenário ─────────────────────────────────────

function gerarObservacoes(
  cenarioId: string,
  params: SimuladorParams,
  derivados: CamposDerivados,
  cenarios: Record<string, CenarioConfig>,
): string[] {
  const obs: string[] = [];

  switch (cenarioId) {
    case 'B3':
      obs.push('Opção 10% para industrial. Obriga comunicação formal ao destinatário (item 1.19 TTD).');
      obs.push('Vantagem para o cliente: se credita 10% em vez de 4%.');
      break;
    case 'B7':
      obs.push('Pessoa física consumidor final — ICMS integral, SEM crédito presumido.');
      break;
    case 'B9':
      obs.push('Destinatário com TTD/diferimento (Pró-Emprego) — CP vedado (art. 246, §6º, IV).');
      break;
    case 'B10':
      obs.push('Destinatário têxtil/confecções (art. 15, XXXIX) — obrigatório 10%.');
      break;
    case 'B11':
      obs.push('CD Exclusivo (Booster) — enviar comunicação ao CD (estorno + declaração anual).');
      break;
    case 'B12':
      obs.push('Transferência interna para filial SC — diferido, sem CP.');
      break;
    case 'A8':
      obs.push('Cobre/Aço — carga efetiva 0,6% (não 1,0%).');
      break;
    case 'A9':
      obs.push('Transferência interestadual — equivale a comercialização (art. 246, §17). CP se aplica.');
      break;
    case 'DEVOLUCAO':
      obs.push('Devolução — estornar CP (item 1.20 TTD). Fundos: creditar via DCIP 54.');
      break;
    case 'DESCONHECIDO':
      obs.push('Cenário não identificado — verificar manualmente.');
      break;
  }

  const cenarioConfig = cenarios[cenarioId];
  if (cenarioConfig && cenarioConfig.fundos > 0) {
    obs.push('Fundos 0,4% sobre BC integral (FUMDES + FIA — Portaria SEF 143/2022).');
  }

  if (derivados.isCAMEX && derivados.operacao === 'interestadual') {
    obs.push('NCM sem similar nacional (CAMEX) — alíquota interestadual 12% ou 7% conforme UF.');
  }

  if (cenarioId === 'B5' || cenarioId === 'B5-CAMEX') {
    obs.push('SN sem ST: destaque com alíquota interna (12%/17%). Sem diferimento parcial.');
  }

  if (cenarioId === 'B1' && params.destCnpj) {
    obs.push('Se destinatário é industrial, considerar opção 10% (cenário B3) — mais crédito para o cliente.');
  }

  return obs;
}

// ── Escolher alíquota default ───────────────────────────────────

function escolherAliquotaDefault(
  cenario: CenarioConfig,
  destUf: string,
  config: AppConfig,
  derivados: CamposDerivados,
): number {
  if (cenario.aliquotasAceitas.length === 0) return 0;
  if (cenario.aliquotasAceitas.length === 1) return cenario.aliquotasAceitas[0];

  // CAMEX interestadual com múltiplas alíquotas: usar alíquota conforme UF destino
  if (derivados.isCAMEX && derivados.operacao === 'interestadual') {
    const ufUpper = destUf.toUpperCase();
    if (config.ufAliquotas[ufUpper]) return config.ufAliquotas[ufUpper];
    const ufs12 = ['PR', 'RJ', 'RS', 'SP'];
    return ufs12.includes(ufUpper) ? 12 : 7;
  }

  // Cenários com alíquota interna: default 17%
  if (cenario.aliquotasAceitas.includes(17)) return 17;

  return cenario.aliquotasAceitas[0];
}

// ── Simulador principal ─────────────────────────────────────────

export function simular(params: SimuladorParams, config: AppConfig, regras: RegrasConfig): SimuladorResult {
  const itemShim = {
    ncm: params.ncm,
    cfop: '',
    pICMS: 0,
    cCredPresumido: '',
    cst: params.temST ? '010' : '000',
    cstOrig: params.cstOrigem ?? '1',
  } as ItemData;
  const nfeShim = {
    emitUF: 'SC',
    dest: {
      uf: params.destUf,
      cnpj: params.destCnpj ?? '',
      cpf: params.isPessoaFisica ? 'PF' : '',
      indIEDest: params.destRegime === 'normal' ? '1' : '9',
      ie: params.destRegime === 'normal' ? 'ACTIVE' : '',
    },
  } as NfeData;

  const vedacaoResults = verificarVedacoes(itemShim, nfeShim, config, regras);
  const isVedado = vedacaoResults.some(v => v.status === 'ERRO');
  const vedacaoMsg = vedacaoResults.map(v => v.mensagem).join(' | ');

  const cenarios = getCenarios(regras);
  const derivados = buildCamposDerivadosSimulador(params, config);
  const resolvido = resolverCenario(regras.grupos, derivados);
  const cenarioId = resolvido?.cenarioId ?? 'DESCONHECIDO';
  const cenario = resolvido ? cenarios[cenarioId] : undefined;

  if (!cenario) {
    return {
      aliquotaDestacada: 0,
      icmsDestacado: 0,
      icmsRecolhimento: { valor: 0, pct: 0 },
      fundosSociais: { valor: 0, pct: 0 },
      totalRecolher: { valor: 0, pct: 0 },
      creditoPresumido: 0,
      cenarioClassificado: cenarioId,
      cenarioNome: cenarioId === 'DEVOLUCAO'
        ? 'Devolução — estornar CP'
        : 'Cenário não identificado',
      refTTD: '',
      observacoes: gerarObservacoes(cenarioId, params, derivados, cenarios),
      bcIntegral: params.valorOperacao,
      ncm: params.ncm,
      isVedado,
      vedacaoMsg: vedacaoMsg ?? '',
    };
  }

  const aliquota = escolherAliquotaDefault(cenario, params.destUf, config, derivados);

  const cobreAco = derivados.isCobreAco;
  const cargaEfetivaOverride = (cobreAco && Math.abs(aliquota - 4) < 0.01) ? 0.6 : undefined;

  const calc = calcularTTD(cenario, params.valorOperacao, aliquota, cargaEfetivaOverride);
  const observacoes = gerarObservacoes(cenarioId, params, derivados, cenarios);

  if (cobreAco && cargaEfetivaOverride !== undefined) {
    observacoes.push('Cobre/Aço — carga efetiva 0,6% (não ' + cenario.cargaEfetiva + '%).');
  }

  const icmsDestacado = Math.round(calc.bcIntegral * calc.aliquotaDestacada) / 100;

  return {
    aliquotaDestacada: calc.aliquotaDestacada,
    icmsDestacado,
    icmsRecolhimento: { valor: calc.icmsRecolhimento, pct: calc.icmsRecolhimentoPct },
    fundosSociais: { valor: calc.fundosSociais, pct: calc.fundosSociaisPct },
    totalRecolher: { valor: calc.totalRecolher, pct: calc.totalRecolherPct },
    creditoPresumido: calc.creditoPresumido,
    cenarioClassificado: cenarioId,
    cenarioNome: cenario.nome,
    refTTD: cenario.refTTD,
    observacoes,
    bcIntegral: calc.bcIntegral,
    ncm: params.ncm,
    isVedado,
    vedacaoMsg: vedacaoMsg ?? '',
  };
}
```

- [ ] **Step 1.4: Atualizar SimuladorPage para `regras` obrigatório**

Em `src/components/SimuladorPage.tsx`, localizar:

```typescript
  regras?: import('../types/regras.ts').RegrasConfig;
```

Substituir por:

```typescript
  regras: import('../types/regras.ts').RegrasConfig;
```

- [ ] **Step 1.5: Executar testes e confirmar que passam**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npm run test -- src/simulator/__tests__/index.test.ts
```

Esperado: PASS — 3 testes passando.

- [ ] **Step 1.6: Executar toda a suite para verificar regressões**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npm run test
```

Esperado: todos os testes existentes continuam passando.

- [ ] **Step 1.7: Commit**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && git add src/simulator/index.ts src/simulator/__tests__/index.test.ts src/components/SimuladorPage.tsx && git commit -m "feat: simulator uses rule engine instead of hardcoded decision tree"
```

---

## Task 2: Dashboard — aceitar regras como prop

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 2.1: Atualizar imports em Dashboard.tsx**

Localizar a linha:

```typescript
import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { getCenarios } from '../engine/cenarios.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
```

Substituir por:

```typescript
import { useMemo } from 'react';
import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { getCenarios } from '../engine/cenarios.ts';
```

- [ ] **Step 2.2: Adicionar `regras` em DashboardProps**

Localizar:

```typescript
interface DashboardProps {
  results: NfeValidation[];
  /** Total de XMLs enviados no(s) upload(s) desta sessão */
  uploadedTotal?: number;
  discardedByCfop?: number;
  discardedZero?: number;
  /** Ignoradas por duplicidade (mesma chave NF-e já processada) */
  discardedDuplicates?: number;
  config: AppConfig;
}
```

Substituir por:

```typescript
interface DashboardProps {
  results: NfeValidation[];
  /** Total de XMLs enviados no(s) upload(s) desta sessão */
  uploadedTotal?: number;
  discardedByCfop?: number;
  discardedZero?: number;
  /** Ignoradas por duplicidade (mesma chave NF-e já processada) */
  discardedDuplicates?: number;
  config: AppConfig;
  regras: RegrasConfig;
}
```

- [ ] **Step 2.3: Adicionar parâmetro `cenariosMap` em `buildGroups`**

Localizar:

```typescript
function buildGroups(results: NfeValidation[], config: AppConfig): {
```

Substituir por:

```typescript
function buildGroups(results: NfeValidation[], config: AppConfig, cenariosMap: Record<string, CenarioConfig>): {
```

- [ ] **Step 2.4: Remover `cenariosMap` de nível de módulo e mover para dentro do componente**

Localizar e remover a linha:

```typescript
const cenariosMap = getCenarios(getDefaultRegras());
```

- [ ] **Step 2.5: Atualizar a função do componente Dashboard**

Localizar:

```typescript
export function Dashboard({ results, uploadedTotal = 0, discardedByCfop = 0, discardedZero = 0, discardedDuplicates = 0, config }: DashboardProps) {
```

Substituir por:

```typescript
export function Dashboard({ results, uploadedTotal = 0, discardedByCfop = 0, discardedZero = 0, discardedDuplicates = 0, config, regras }: DashboardProps) {
  const cenariosMap = useMemo(() => getCenarios(regras), [regras]);
```

Obs.: o `{` de abertura do corpo do componente já existe — a linha do `useMemo` deve ser a primeira linha do corpo do componente.

- [ ] **Step 2.6: Atualizar chamada de `buildGroups` dentro do componente**

Localizar (dentro do componente, onde `buildGroups` é chamado):

```typescript
buildGroups(results, config)
```

Substituir por:

```typescript
buildGroups(results, config, cenariosMap)
```

- [ ] **Step 2.7: Verificar build sem erros TypeScript**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npx tsc --noEmit 2>&1 | head -40
```

Esperado: pode mostrar erro em `App.tsx` (`regras` não passado ao Dashboard) — isso será corrigido na Task 5. Outros erros inesperados devem ser investigados.

- [ ] **Step 2.8: Commit**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && git add src/components/Dashboard.tsx && git commit -m "feat: Dashboard computes cenariosMap from regras prop"
```

---

## Task 3: ItemDetail — propagar regras pela cadeia NfeListView → NfeCard → ItemDetail

**Files:**
- Modify: `src/components/NfeListView.tsx`
- Modify: `src/components/NfeCard.tsx`
- Modify: `src/components/ItemDetail.tsx`

- [ ] **Step 3.1: Atualizar ItemDetail.tsx**

Em `src/components/ItemDetail.tsx`, substituir:

```typescript
import { CENARIOS } from '../engine/cenarios.ts';
```

Por:

```typescript
import { getCenarios } from '../engine/cenarios.ts';
import type { RegrasConfig } from '../types/regras.ts';
```

Localizar:

```typescript
interface ItemDetailProps {
  iv: ItemValidation;
}
```

Substituir por:

```typescript
interface ItemDetailProps {
  iv: ItemValidation;
  regras: RegrasConfig;
}
```

Localizar:

```typescript
export function ItemDetail({ iv }: ItemDetailProps) {
  const cenario = CENARIOS[iv.cenario];
```

Substituir por:

```typescript
export function ItemDetail({ iv, regras }: ItemDetailProps) {
  const cenario = getCenarios(regras)[iv.cenario];
```

- [ ] **Step 3.2: Atualizar NfeCard.tsx**

Em `src/components/NfeCard.tsx`, adicionar após os imports existentes:

```typescript
import type { RegrasConfig } from '../types/regras.ts';
```

Localizar:

```typescript
interface NfeCardProps {
  validation: NfeValidation;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}
```

Substituir por:

```typescript
interface NfeCardProps {
  validation: NfeValidation;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  regras: RegrasConfig;
}
```

Localizar a desestruturação do componente NfeCard (começa com `export function NfeCard({`). Adicionar `regras` na desestruturação. Exemplo — se a linha for:

```typescript
export function NfeCard({ validation, cnpjInfoMap }: NfeCardProps) {
```

Substituir por:

```typescript
export function NfeCard({ validation, cnpjInfoMap, regras }: NfeCardProps) {
```

Localizar onde `<ItemDetail` é renderizado:

```typescript
<ItemDetail key={idx} iv={iv} />
```

Substituir por:

```typescript
<ItemDetail key={idx} iv={iv} regras={regras} />
```

- [ ] **Step 3.3: Atualizar NfeListView.tsx**

Em `src/components/NfeListView.tsx`, adicionar após os imports existentes:

```typescript
import type { RegrasConfig } from '../types/regras.ts';
```

Localizar:

```typescript
interface NfeListViewProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}
```

Substituir por:

```typescript
interface NfeListViewProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  regras: RegrasConfig;
}
```

Localizar a desestruturação do componente NfeListView (começa com `export function NfeListView({`). Adicionar `regras` na desestruturação. Exemplo:

```typescript
export function NfeListView({ results, filters, cnpjInfoMap }: NfeListViewProps) {
```

Substituir por:

```typescript
export function NfeListView({ results, filters, cnpjInfoMap, regras }: NfeListViewProps) {
```

Localizar onde `<NfeCard` é renderizado (pode aparecer mais de uma vez):

```typescript
<NfeCard validation={filtered[selectedIdx]} cnpjInfoMap={cnpjInfoMap} />
```

Substituir por:

```typescript
<NfeCard validation={filtered[selectedIdx]} cnpjInfoMap={cnpjInfoMap} regras={regras} />
```

E também:

```typescript
<NfeCard key={idx} validation={r} cnpjInfoMap={cnpjInfoMap} />
```

Substituir por:

```typescript
<NfeCard key={idx} validation={r} cnpjInfoMap={cnpjInfoMap} regras={regras} />
```

- [ ] **Step 3.4: Verificar build**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npx tsc --noEmit 2>&1 | head -40
```

Esperado: pode mostrar erro em `App.tsx` onde `NfeListView` é chamado sem `regras`. Será corrigido na Task 5.

- [ ] **Step 3.5: Commit**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && git add src/components/NfeListView.tsx src/components/NfeCard.tsx src/components/ItemDetail.tsx && git commit -m "feat: propagate regras prop through NfeListView -> NfeCard -> ItemDetail"
```

---

## Task 4: exportExcel + ExportButton — aceitar regras

**Files:**
- Modify: `src/utils/exportExcel.ts`
- Modify: `src/components/ExportButton.tsx`

- [ ] **Step 4.1: Atualizar exportExcel.ts**

Em `src/utils/exportExcel.ts`, substituir:

```typescript
import { CENARIOS } from '../engine/cenarios.ts';
import { buildReconciliacao } from '../engine/reconciliacao.ts';
```

Por:

```typescript
import { getCenarios } from '../engine/cenarios.ts';
import { buildReconciliacao } from '../engine/reconciliacao.ts';
import type { RegrasConfig } from '../types/regras.ts';
```

Localizar:

```typescript
export function exportToExcel(results: NfeValidation[]): void {
```

Substituir por:

```typescript
export function exportToExcel(results: NfeValidation[], regras: RegrasConfig): void {
  const cenariosMap = getCenarios(regras);
```

Localizar dentro de `exportToExcel`:

```typescript
      const cenario = CENARIOS[iv.cenario];
```

Substituir por:

```typescript
      const cenario = cenariosMap[iv.cenario];
```

Localizar:

```typescript
  const reconciliacao = buildReconciliacao(results);
```

Substituir por:

```typescript
  const reconciliacao = buildReconciliacao(results, regras);
```

- [ ] **Step 4.2: Atualizar ExportButton.tsx**

Em `src/components/ExportButton.tsx`, substituir:

```typescript
import type { NfeValidation } from '../types/validation.ts';
import { exportToExcel } from '../utils/exportExcel.ts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  results: NfeValidation[];
}

export function ExportButton({ results }: ExportButtonProps) {
  if (results.length === 0) return null;

  return (
    <Button
      onClick={() => exportToExcel(results)}
      size="sm"
      aria-label="Exportar resultados para Excel"
    >
      <Download size={15} aria-hidden />
      Exportar
    </Button>
  );
}
```

Por:

```typescript
import type { NfeValidation } from '../types/validation.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { exportToExcel } from '../utils/exportExcel.ts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  results: NfeValidation[];
  regras: RegrasConfig;
}

export function ExportButton({ results, regras }: ExportButtonProps) {
  if (results.length === 0) return null;

  return (
    <Button
      onClick={() => exportToExcel(results, regras)}
      size="sm"
      aria-label="Exportar resultados para Excel"
    >
      <Download size={15} aria-hidden />
      Exportar
    </Button>
  );
}
```

- [ ] **Step 4.3: Verificar build**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npx tsc --noEmit 2>&1 | head -40
```

Esperado: pode mostrar erro em `App.tsx` onde `ExportButton` é chamado sem `regras`. Será corrigido na Task 5.

- [ ] **Step 4.4: Commit**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && git add src/utils/exportExcel.ts src/components/ExportButton.tsx && git commit -m "feat: exportExcel and ExportButton use regras from props"
```

---

## Task 5: App.tsx — passar regras para todos os componentes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 5.1: Passar `regras` ao Dashboard**

Em `src/App.tsx`, localizar:

```typescript
            <Dashboard
              results={results}
              uploadedTotal={results.length + discardedByCfop + discardedZero + discardedDuplicates + parseErrors.length}
              discardedByCfop={discardedByCfop}
              discardedZero={discardedZero}
              discardedDuplicates={discardedDuplicates}
              config={config}
            />
```

Substituir por:

```typescript
            <Dashboard
              results={results}
              uploadedTotal={results.length + discardedByCfop + discardedZero + discardedDuplicates + parseErrors.length}
              discardedByCfop={discardedByCfop}
              discardedZero={discardedZero}
              discardedDuplicates={discardedDuplicates}
              config={config}
              regras={regras}
            />
```

- [ ] **Step 5.2: Passar `regras` ao NfeListView**

Localizar:

```typescript
                <NfeListView results={results} filters={filters} cnpjInfoMap={cnpjInfoMap} />
```

Substituir por:

```typescript
                <NfeListView results={results} filters={filters} cnpjInfoMap={cnpjInfoMap} regras={regras} />
```

- [ ] **Step 5.3: Passar `regras` ao ExportButton**

Localizar:

```typescript
              <ExportButton results={results} />
```

Substituir por:

```typescript
              <ExportButton results={results} regras={regras} />
```

- [ ] **Step 5.4: Verificar build sem erros TypeScript**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npx tsc --noEmit 2>&1 | head -40
```

Esperado: nenhum erro TypeScript.

- [ ] **Step 5.5: Executar suite de testes completa**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npm run test
```

Esperado: todos os testes passando (incluindo o novo teste do simulador da Task 1).

- [ ] **Step 5.6: Commit**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && git add src/App.tsx && git commit -m "feat: pass regras to Dashboard, NfeListView, and ExportButton"
```

---

## Task 6: GrupoEditor — corrigir Bug #2 (última ramificação) e Bug #1 (tooltip)

**Files:**
- Modify: `src/components/regras/GrupoEditor.tsx`

- [ ] **Step 6.1: Remover restrição de mínimo 1 ramificação (Bug #2)**

Em `src/components/regras/GrupoEditor.tsx`, localizar:

```typescript
              canRemove={grupo.ramificacoes.length > 1}
```

Substituir por:

```typescript
              canRemove={true}
```

- [ ] **Step 6.2: Adicionar imports para tooltip e ícone Info**

Localizar no início do arquivo a linha que importa de lucide-react (contém `Trash2, Plus`):

```typescript
import { Trash2, Plus } from 'lucide-react';
```

Substituir por:

```typescript
import { Trash2, Plus, Info } from 'lucide-react';
```

Adicionar import do Tooltip (após os outros imports de shadcn):

```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

- [ ] **Step 6.3: Adicionar tooltip ao título "Valores Base"**

Localizar:

```typescript
          <CardTitle className="text-sm">Valores Base (compartilhados)</CardTitle>
```

Substituir por:

```typescript
          <CardTitle className="text-sm flex items-center gap-1.5">
            Valores Base (compartilhados)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={13} className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Template compartilhado por todas as ramificacoes. Cada ramificacao herda estes valores e pode sobrescrever campos especificos. Se nenhuma ramificacao casar com as condicoes da NF-e, o grupo inteiro nao dispara.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
```

- [ ] **Step 6.4: Verificar build**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npx tsc --noEmit 2>&1 | head -40
```

Esperado: nenhum erro TypeScript.

- [ ] **Step 6.5: Executar suite completa**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && npm run test
```

Esperado: todos os testes passando.

- [ ] **Step 6.6: Commit**

```bash
cd /Users/maicongorges/Documents/tech/icms-auditor && git add src/components/regras/GrupoEditor.tsx && git commit -m "fix: allow deleting last branch in group editor; add base values tooltip"
```

---

## Verificação Final

Após concluir todas as tasks, verificar os critérios de sucesso do spec:

1. Abrir o simulador, selecionar PF interestadual, verificar que o cenário exibido corresponde ao configurado no módulo de regras
2. Alterar `cargaEfetiva` de um cenário nas regras → simular novamente → confirmar que o valor reflete a mudança
3. No GrupoEditor: criar um grupo com 1 ramificação → botão de deletar deve estar habilitado
4. Verificar tooltip ao passar o mouse sobre o ícone `ℹ` ao lado de "Valores Base"
5. Exportar um Excel e confirmar que a coluna "Aliq. Esperada" mostra os valores do cenário configurado
