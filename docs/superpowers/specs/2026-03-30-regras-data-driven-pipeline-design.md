# Design: Pipeline 100% Data-Driven (Regras do Firebase)

**Data:** 2026-03-30
**Status:** Aprovado

## Contexto

O ICMS Auditor possui um módulo de configuração de regras (Firebase) que permite ao usuário cadastrar grupos, ramificações, condições e valores esperados. Porém, o simulador, o dashboard e a exportação Excel ainda consumiam um snapshot estático das regras gerado na inicialização do app a partir de `defaultRegras.ts`. Alterações salvas pelo usuário não eram refletidas nessas telas.

A auditoria (validação de XMLs) já estava correta — `App.tsx` passa `regras` do Firebase para `validarNfe()`, que o repassa ao motor de classificação.

---

## Objetivo

Garantir que **todo** o sistema — auditoria, simulador, dashboard e exportação — use exclusivamente as regras configuradas pelo usuário no Firebase. Nenhum módulo de produção deve hardcodar lógica de classificação ou valores de cenários.

---

## Problemas identificados

### P1 — Simulador usa árvore de decisão hardcoded
`simulator/index.ts`: a função `classificarCenarioSimulador()` reimplementa a classificação com `if/else` fixos (ex: `if (isPF) return 'A6'`). Não chama o motor de regras. Quando o usuário muda condições ou valores de PF/não-contribuinte, o simulador ignora.

### P2 — Simulador usa CENARIOS estático
`simulator/index.ts` importa `CENARIOS` de `engine/cenarios.ts`, que é gerado **uma vez** com `getCenarios(getDefaultRegras())` em nível de módulo. Valores como `cargaEfetiva`, `aliquotasAceitas` e `refTTD` nunca atualizam.

### P3 — Dashboard usa cenariosMap estático
`Dashboard.tsx:37`: `const cenariosMap = getCenarios(getDefaultRegras())` em nível de módulo — calculado na carga do bundle, nunca recalculado com as regras do Firebase.

### P4 — ItemDetail usa CENARIOS estático
`ItemDetail.tsx:114`: `const cenario = CENARIOS[iv.cenario]` — mesmo problema.

### P5 — exportExcel usa CENARIOS estático
`exportExcel.ts:44`: `const cenario = CENARIOS[iv.cenario]` — aliquotas exportadas no Excel vêm dos defaults.

### P6 — Não permite apagar última ramificação
`GrupoEditor.tsx:452`: `canRemove={grupo.ramificacoes.length > 1}` — bloqueia deleção quando só resta 1 ramificação, impedindo o usuário de reorganizar a estrutura.

### P7 — Hierarquia de base vs. ramificação não é clara na UI
Nenhuma explicação na tela sobre o comportamento de merge: valores base são template; sem ramificação que case, o grupo não dispara.

---

## Design da Solução

### 1. Simulador — substituir classificação hardcoded pelo motor de regras

**Remover:** `classificarCenarioSimulador()` inteiro.

**Adicionar:** `buildCamposDerivadosSimulador(params, config, regras)` que converte `SimuladorParams` → `CamposDerivados`:

```
operacao     ← params.destUf !== 'SC' ? 'interestadual' : 'interna'
tipoDest     ← isPF → 'pf' | destRegime === 'nao_contribuinte' → 'pj_nc' | 'simples_nacional' → 'sn' | 'normal' → 'contribuinte'
isCAMEX      ← params.isCamex || params.cstOrigem === '6'
isCobreAco   ← isCobreAco(params.ncm, config.listaCobreAco)
temST        ← params.temST
cfopMatch    ← null (simulador não lida com devolução/transferência)
listaEspecial← derivada de params.destCnpj contra config.listaVedacao25a/b, listaCD, listaIndustriais
aplicacao    ← params.aplicacao ?? null
```

**Classificação:** `resolverCenario(regras.grupos, derivados)` → retorna `CenarioResolvido | null`.

**Lookup de config:** `getCenarios(regras)[cenarioId]` (dinâmico, não estático).

**`escolherAliquotaDefault()` — remover IDs hardcoded:**
Hoje: `if (['A2', 'A5', 'A7'].includes(cenario.id))`.
Após: se `isCAMEX && operacao === 'interestadual' && cenario.aliquotasAceitas.length > 1`, usa lookup por UF via `config.ufAliquotas`. Sem dependência de ID.

O parâmetro `regras?: RegrasConfig` em `simular()` já existe; deixa de ser opcional — passa a ser obrigatório. `SimuladorPage` já recebe `regras={regras}` de `App.tsx` ✅ — nenhuma mudança de prop necessária ali.

### 2. Dashboard — receber regras como prop

Adicionar `regras: RegrasConfig` a `DashboardProps`.
Mover `cenariosMap` de nível de módulo para dentro do componente com `useMemo(() => getCenarios(regras), [regras])`.
`App.tsx` passa `regras` ao `<Dashboard>` — hoje não passa, precisa ser adicionado.

### 3. ItemDetail — receber regras como prop

Adicionar `regras: RegrasConfig` a `ItemDetailProps`.
Substituir `CENARIOS[iv.cenario]` por `getCenarios(regras)[iv.cenario]`.
Adicionar `regras` na cadeia: `App.tsx → NfeListView → ItemDetail`. App.tsx hoje não passa `regras` ao `<NfeListView>` — precisa ser adicionado.

### 4. exportExcel — receber regras como parâmetro

Alterar assinatura: `exportToExcel(results, regras)`.
Substituir `CENARIOS[iv.cenario]` por `getCenarios(regras)[iv.cenario]`.
`buildReconciliacao` já recebe `regras` — verificar se passa corretamente.
`ExportButton` recebe `regras` e repassa.
`App.tsx` passa `regras` ao `<ExportButton>` — hoje não passa, precisa ser adicionado.

### 5. Bug #2 — permitir apagar última ramificação

`GrupoEditor.tsx:452`: remover restrição `canRemove={grupo.ramificacoes.length > 1}`.
Um grupo sem ramificações simplesmente não faz match — comportamento válido e esperado.

### 6. Bug #1 — tooltip de hierarquia no GrupoEditor

Adicionar ícone `Info` com tooltip ao lado do título da seção "Valores Base":

> "Valores base são um template compartilhado por todas as ramificações. Cada ramificação herda esses valores e pode sobrescrever campos específicos. Se nenhuma ramificação casar com as condições da NF-e, o grupo inteiro não dispara."

---

## O que NÃO muda

- `useState<RegrasConfig>(getDefaultRegras)` em `App.tsx` — correto, evita tela em branco durante carregamento do Firebase.
- Os fallbacks `_defaultRegras` nos engines (`classifier.ts`, `validator.ts`, etc.) — só ativados se chamados sem `regras`; não ocorre no fluxo principal.
- Testes unitários (`cfop.test.ts`, `aliquota.test.ts`) — usam `CENARIOS` dos defaults diretamente; testam lógica de validação com cenários fixos, não o pipeline completo. Não precisam mudar.
- `defaultRegras.ts` e `getDefaultRegras()` continuam existindo como estado inicial e para testes.

---

## Fluxo após a correção

```
Firebase (Firestore)
      ↓
  App.tsx — regras: RegrasConfig
      ├── validarNfe(nfe, config, cnpjInfoMap, regras)   ✅ já correto
      ├── <SimuladorPage regras={regras} />              → simular(params, config, regras)
      │       └── resolverCenario(regras.grupos, derivados)
      ├── <Dashboard regras={regras} />                  → getCenarios(regras)
      ├── <NfeListView regras={regras} />
      │       └── <ItemDetail regras={regras} />         → getCenarios(regras)[id]
      └── <ExportButton regras={regras} />               → exportToExcel(results, regras)
```

---

## Critérios de sucesso

1. Alterar `cargaEfetiva` de um cenário interestadual PF para `-1` (TTD não se aplica) → simulador reflete sem reiniciar o app.
2. Alterar `aliquotasAceitas` de um cenário → dashboard e exportação Excel mostram os novos valores.
3. Apagar a última ramificação de um grupo é permitido.
4. Tooltip de hierarquia visível ao lado de "Valores Base" no GrupoEditor.
5. Nenhuma regressão na auditoria de XMLs.
