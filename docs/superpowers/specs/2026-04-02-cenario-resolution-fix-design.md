# Design: Correção Estrutural do Motor de Resolução de Cenários

**Data:** 2026-04-02
**Escopo:** Corrigir 5 bugs/falhas estruturais que causavam valores incorretos no simulador e ignoravam configurações salvas no Firebase.

---

## Contexto

O motor de regras resolve cenários fiscais (B1–B12, A1–A9) a partir de grupos configuráveis com branches (ramificações). Dois grupos — `G-INTERNA-PJNC` (B6) e `G-INTERNA-SN-SEMST` (B5) — têm múltiplas branches compartilhando o mesmo `cenarioId`. Isso criou uma série de falhas em cascata.

---

## Decisão Arquitetural: `cenarioId` como conceito de display

`cenarioId` (ex: B6) identifica um **cenário fiscal**, não uma branch específica. Todas as branches de um grupo compartilham o mesmo cenarioId porque representam variantes do mesmo cenário.

**Dois fluxos distintos:**

```
RESOLUÇÃO (simulador/auditor por item)
resolverCenario() → resolvido.config  →  usar diretamente, nunca relookup no mapa

DISPLAY/VALIDAÇÃO AUDITORIA (validator, dashboard, export)
getCenarios() → mapa canônico  →  uma entrada por cenarioId = branch catch-all
```

Consumidores que precisam da config resolvida devem recebê-la por parâmetro a partir de `resolverCenario`. O mapa `getCenarios` é exclusivo para display e validação do auditor, onde a `aplicacao` do item não é conhecida.

---

## Bugs identificados

| # | Severidade | Arquivo | Descrição |
|---|---|---|---|
| 1 | Crítico | `regrasService.ts` | `isGrupoStructureCompatible` rejeita configurações Firebase válidas onde o usuário removeu branches com `condicaoExtra`, causando fallback silencioso para o default |
| 2 | Médio | `engine/cenarios.ts` | `getCenarios` retorna a última branch iterada por `cenarioId` — acidentalmente correto no default, quebra quando ordem muda ou usuário personaliza |
| 3 | Médio | `simulator/index.ts` | `gerarObservacoes` faz lookup em `cenarios[cenarioId]` (mapa com last-branch-wins) em vez de usar a config já resolvida |
| 4 | Médio | `SimuladorPage.tsx` | `defaultNcmEntry()` inicializa `aplicacao: 'revenda'` — toda simulação sem seleção explícita cai na branch revenda (override `[12]`) |
| 5 | Baixo | `simulator/index.ts` | `getCenarios(regras)` chamado em `simular` apenas para passar para `gerarObservacoes` — uso desnecessário após fix 3 |

---

## Mudanças

### Fix 1 — `regrasService.ts`: simplificar `isGrupoStructureCompatible`

Remover o Check 2 (verificação de presença de `condicaoExtra` nas branches). Manter apenas a verificação de chaves de condição do grupo.

**Motivação:** o Check 2 foi criado para detectar schemas antigos (antes de `condicaoExtra` existir). Mas ele não distingue schema antigo de customização válida onde o usuário intencionalmente simplificou as branches. O único indicador real de schema incompatível é quando as chaves do objeto `condicoes` do grupo divergem (novo campo adicionado ao tipo).

**Antes:**
```ts
function isGrupoStructureCompatible(firestoreGrupo, defaultGrupo): boolean {
  const defaultCondKeys = Object.keys(defaultGrupo.condicoes).sort().join(',');
  const firestoreCondKeys = Object.keys(firestoreGrupo.condicoes).sort().join(',');
  if (defaultCondKeys !== firestoreCondKeys) return false;

  // REMOVER: rejeita customizações válidas
  const defaultHasCondicaoExtra = defaultGrupo.ramificacoes.some(r => r.condicaoExtra !== undefined);
  if (defaultHasCondicaoExtra) {
    const firestoreHasCondicaoExtra = firestoreGrupo.ramificacoes.some(r => r.condicaoExtra !== undefined);
    if (!firestoreHasCondicaoExtra) return false;
  }
  return true;
}
```

**Depois:**
```ts
function isGrupoStructureCompatible(firestoreGrupo, defaultGrupo): boolean {
  const defaultCondKeys = Object.keys(defaultGrupo.condicoes).sort().join(',');
  const firestoreCondKeys = Object.keys(firestoreGrupo.condicoes).sort().join(',');
  return defaultCondKeys === firestoreCondKeys;
}
```

---

### Fix 2 — `engine/cenarios.ts`: mapa canônico em `getCenarios`

Ao iterar branches com mesmo `cenarioId`, priorizar explicitamente a branch sem `condicaoExtra` (catch-all) como entrada canônica.

**Motivação:** a catch-all representa o cenário mais abrangente — correto para o auditor que não conhece a `aplicacao` do item. A lógica atual (última branch iterada) é frágil e depende da ordem no array.

**Antes:**
```ts
result[ram.cenarioId] = { id: ram.cenarioId, ... };  // sobrescreve sempre
```

**Depois:**
```ts
// Preferir catch-all (sem condicaoExtra) como canônica
// Se ainda não existe entrada: registrar. Se existe mas esta branch é catch-all: sobrescrever.
if (!result[ram.cenarioId] || !ram.condicaoExtra) {
  result[ram.cenarioId] = { id: ram.cenarioId, ... };
}
```

---

### Fix 3 e 5 — `simulator/index.ts`: eliminar lookup em `gerarObservacoes`

Alterar a assinatura de `gerarObservacoes` para receber `cenario: CenarioConfig | undefined` diretamente. Em `simular`, passar `resolvido.config` (já disponível) e remover a chamada `getCenarios(regras)` que existia apenas para alimentar as observações.

**Antes:**
```ts
function gerarObservacoes(
  cenarioId: string,
  params: SimuladorParams,
  derivados: CamposDerivados,
  cenarios: Record<string, CenarioConfig>,
): string[] {
  const cfg = cenarios[cenarioId];  // lookup no mapa errado
  ...
}

// em simular():
const cenarios = getCenarios(regras);  // chamada desnecessária
...
gerarObservacoes(cenarioId, params, derivados, cenarios);
```

**Depois:**
```ts
function gerarObservacoes(
  cenarioId: string,
  params: SimuladorParams,
  derivados: CamposDerivados,
  cenario: CenarioConfig | undefined,  // config resolvida diretamente
): string[] {
  const cfg = cenario;
  ...
}

// em simular():
// sem getCenarios()
gerarObservacoes(cenarioId, params, derivados, resolvido?.config);
```

---

### Fix 4 — `SimuladorPage.tsx`: remover default `'revenda'`

Alterar `NcmEntry.aplicacao` para `AplicacaoProduto | undefined`. Alterar `defaultNcmEntry` para `aplicacao: undefined`. Adicionar opção "Não informado" como primeira opção no select de aplicação (valor sentinela `'_none'`). Quando selecionado, passar `aplicacao: undefined` para `simular`.

**Antes:**
```ts
interface NcmEntry {
  aplicacao: AplicacaoProduto;  // sempre tem valor
}
function defaultNcmEntry(): NcmEntry {
  return { ..., aplicacao: 'revenda' };  // força revenda
}
```

**Depois:**
```ts
interface NcmEntry {
  aplicacao: AplicacaoProduto | undefined;
}
function defaultNcmEntry(): NcmEntry {
  return { ..., aplicacao: undefined };  // catch-all
}
// Select: <SelectItem value="_none">Não informado</SelectItem> como primeira opção
// Ao construir params: aplicacao: entry.aplicacao (undefined → catch-all no motor)
```

---

### Fix 6 — Testes existentes

Revisar testes que usam `CENARIOS['B5']` ou `CENARIOS['B6']`:
- Com o Fix 2, `CENARIOS['B5']` e `CENARIOS['B6']` passam a retornar a config catch-all (base values, sem override de revenda)
- Qualquer assert que assuma `aliquotasAceitas: [12]` para B5 ou B6 precisa ser atualizado para `[7, 8.80, 12, 17, 25]`
- Os testes do auditor devem usar a config canônica (catch-all) — comportamento correto

---

## O que NÃO muda

- **`cenarioId` strings** (B5, B6): permanecem iguais, sem renomeação. Sem quebra de compat Firebase.
- **`resolverCenario`**: já funciona corretamente — não é tocado.
- **Cross-checks hardcoded** (`aliquota.ts`): `CK12D` (12% veda não-contribuinte) representa regra fiscal real, não precisa ser configurável neste ciclo.
- **`validator.ts`, `reconciliacao.ts`, `exportExcel.ts`**: consomem `getCenarios` para display/validação auditoria — comportamento correto após Fix 2, sem mudança de código.
- **`Dashboard.tsx`**: usa `cenariosMap[cenarioId]?.isCAMEX` e `?.fundos` — estes campos são iguais em todas as branches de B5/B6, sem impacto.

---

## Ordem de implementação

1. Fix 1 — `regrasService.ts` (desbloqueia configurações Firebase)
2. Fix 2 — `engine/cenarios.ts` (corrige mapa canônico)
3. Fix 3 + 5 — `simulator/index.ts` (gerarObservacoes + remove getCenarios)
4. Fix 4 — `SimuladorPage.tsx` (remove default revenda)
5. Fix 6 — Revisar e atualizar testes afetados
