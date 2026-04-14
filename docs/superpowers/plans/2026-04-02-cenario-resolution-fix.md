# Cenario Resolution Structural Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 5 bugs estruturais no motor de resolução de cenários fiscais para que configurações Firebase sejam respeitadas e os valores calculados pelo simulador e auditor reflitam exatamente o que está configurado.

**Architecture:** `cenarioId` é mantido como conceito de display/agrupamento. A config resolvida flui a partir de `resolverCenario` sem relookup no mapa. `getCenarios` retorna a branch catch-all como canônica para uso em display/validação. `mergeGrupos` no Firebase service para de rejeitar customizações válidas do usuário.

**Tech Stack:** TypeScript, Vitest, Firebase Firestore (mock não necessário — funções são puras)

---

## Files Modified

| Arquivo | Mudança |
|---|---|
| `src/firebase/regrasService.ts` | Exportar `mergeGrupos`; remover Check 2 de `isGrupoStructureCompatible` |
| `src/firebase/__tests__/regrasService.test.ts` | Criar — testes para `mergeGrupos` |
| `src/engine/cenarios.ts` | Fix `getCenarios` para preferir branch catch-all como canônica |
| `src/engine/__tests__/cenarios.test.ts` | Criar — testes para `getCenarios` canonical |
| `src/simulator/index.ts` | Fix `gerarObservacoes` signature; remover `getCenarios` do fluxo `simular` |
| `src/components/SimuladorPage.tsx` | Remover `aplicacao: 'revenda'` default; adicionar opção "Não informado" |

---

## Task 1: Fix `regrasService.ts` — parar de rejeitar customizações Firebase válidas

**Context:** `isGrupoStructureCompatible` tem um Check 2 que rejeita qualquer grupo do Firestore que não tenha branches com `condicaoExtra`, mesmo que o usuário tenha intencionalmente simplificado as branches. Quando rejeitado, o grupo do default é usado silenciosamente.

**Files:**
- Modify: `src/firebase/regrasService.ts`
- Create: `src/firebase/__tests__/regrasService.test.ts`

- [ ] **Step 1: Criar test file `src/firebase/__tests__/regrasService.test.ts` com testes que falham**

```ts
import { describe, it, expect } from 'vitest';
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
    condicoes: { operacao: 'interna' as const, tipoDest: ['pj_nc'] as const[] },
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
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
npx vitest run src/firebase/__tests__/regrasService.test.ts
```

Esperado: FAIL com `mergeGrupos is not exported` ou similar.

- [ ] **Step 3: Exportar `mergeGrupos` e remover Check 2 de `isGrupoStructureCompatible` em `src/firebase/regrasService.ts`**

Localizar as linhas 17-31 (função `isGrupoStructureCompatible`) e substituir:

```ts
// Antes:
function isGrupoStructureCompatible(firestoreGrupo: GrupoRegra, defaultGrupo: GrupoRegra): boolean {
  const defaultCondKeys = Object.keys(defaultGrupo.condicoes).sort().join(',');
  const firestoreCondKeys = Object.keys(firestoreGrupo.condicoes).sort().join(',');
  if (defaultCondKeys !== firestoreCondKeys) return false;

  const defaultHasCondicaoExtra = defaultGrupo.ramificacoes.some(r => r.condicaoExtra !== undefined);
  if (defaultHasCondicaoExtra) {
    const firestoreHasCondicaoExtra = firestoreGrupo.ramificacoes.some(r => r.condicaoExtra !== undefined);
    if (!firestoreHasCondicaoExtra) return false;
  }

  return true;
}

// Depois:
function isGrupoStructureCompatible(firestoreGrupo: GrupoRegra, defaultGrupo: GrupoRegra): boolean {
  // Unico indicador de schema incompativel: chaves de condicoes divergem
  // (significa que um novo campo foi adicionado ao tipo CondicoesCenario)
  // Remover/adicionar branches com condicaoExtra e uma customizacao valida do usuario.
  const defaultCondKeys = Object.keys(defaultGrupo.condicoes).sort().join(',');
  const firestoreCondKeys = Object.keys(firestoreGrupo.condicoes).sort().join(',');
  return defaultCondKeys === firestoreCondKeys;
}
```

Localizar a linha 41 (declaracao de `mergeGrupos`) e adicionar `export`:

```ts
// Antes:
function mergeGrupos(firestoreGrupos: GrupoRegra[], defaultGrupos: GrupoRegra[]): GrupoRegra[] {

// Depois:
/** Exportado para testes. Faz merge dos grupos Firestore com os defaults. */
export function mergeGrupos(firestoreGrupos: GrupoRegra[], defaultGrupos: GrupoRegra[]): GrupoRegra[] {
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx vitest run src/firebase/__tests__/regrasService.test.ts
```

Esperado: 4 testes passando.

- [ ] **Step 5: Rodar suite completa para garantir nenhuma regressao**

```bash
npm test
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/firebase/regrasService.ts src/firebase/__tests__/regrasService.test.ts
git commit -m "fix: respeitar customizacoes Firebase ao remover Check 2 de isGrupoStructureCompatible

Grupos do Firestore com branches simplificadas (sem condicaoExtra) eram
silenciosamente descartados e substituidos pelo default. O Check 2 nao
conseguia distinguir schema antigo de customizacao valida.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Fix `getCenarios` — mapa canônico usa branch catch-all

**Context:** `getCenarios` itera branches e sobrescreve `result[cenarioId]` na ultima iteracao. Para B5/B6 (que tem catch-all como ultima branch no default), funciona por acidente. Mas e frágil e quebra se o usuario customizar a ordem ou adicionar branches.

**Files:**
- Modify: `src/engine/cenarios.ts`
- Create: `src/engine/__tests__/cenarios.test.ts`

- [ ] **Step 1: Criar `src/engine/__tests__/cenarios.test.ts` com testes que falham**

```ts
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
    // Deve usar catch-all (base values [17, 25]), nao a branch revenda ([12])
    expect(mapa['B6']?.aliquotasAceitas).toEqual([17, 25]);
  });

  it('usa primeira branch quando todas tem condicaoExtra (nenhuma catch-all)', () => {
    const regras: RegrasConfig = {
      grupos: [{
        id: 'G-TEST',
        nome: 'Teste',
        descricao: '',
        prioridade: 1,
        ativo: true,
        condicoes: { operacao: 'interestadual', tipoDest: ['contribuinte'] },
        valoresBase: makeValoresBase([]),
        ramificacoes: [
          {
            cenarioId: 'A2',
            nome: 'CAMEX',
            prioridade: 1,
            condicaoExtra: { camex: true as const },
            override: { aliquotasAceitas: [12, 7] },
          },
          {
            cenarioId: 'A1',
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
    // A2 e A1 tem IDs unicos — comportamento normal
    expect(mapa['A2']?.aliquotasAceitas).toEqual([12, 7]);
    expect(mapa['A1']?.aliquotasAceitas).toEqual([4]);
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
```

- [ ] **Step 2: Rodar os testes para confirmar que o primeiro falha**

```bash
npx vitest run src/engine/__tests__/cenarios.test.ts
```

Esperado: primeiro teste FAIL (retorna [12] em vez de [17, 25]). Outros dois devem PASS pois ja funcionam.

- [ ] **Step 3: Corrigir `getCenarios` em `src/engine/cenarios.ts`**

Substituir o corpo do loop interno (linhas 10-26):

```ts
// Antes:
for (const ram of grupo.ramificacoes) {
  const valores = mergeValores(grupo.valoresBase, ram.override);
  result[ram.cenarioId] = {
    id: ram.cenarioId,
    nome: ram.nome,
    isCAMEX: grupo.condicoes.camex === true || ram.condicaoExtra?.camex === true,
    aliquotasAceitas: valores.aliquotasAceitas,
    cargaEfetiva: valores.cargaEfetiva,
    fundos: valores.fundos,
    cstEsperado: valores.cstEsperado,
    cfopsEsperados: valores.cfopsEsperados,
    temCP: valores.temCP,
    temDiferimentoParcial: valores.temDiferimentoParcial,
    refTTD: valores.refTTD,
  };
}

// Depois:
for (const ram of grupo.ramificacoes) {
  const valores = mergeValores(grupo.valoresBase, ram.override);
  const config: CenarioConfig = {
    id: ram.cenarioId,
    nome: ram.nome,
    isCAMEX: grupo.condicoes.camex === true || ram.condicaoExtra?.camex === true,
    aliquotasAceitas: valores.aliquotasAceitas,
    cargaEfetiva: valores.cargaEfetiva,
    fundos: valores.fundos,
    cstEsperado: valores.cstEsperado,
    cfopsEsperados: valores.cfopsEsperados,
    temCP: valores.temCP,
    temDiferimentoParcial: valores.temDiferimentoParcial,
    refTTD: valores.refTTD,
  };
  // Preferir branch catch-all (sem condicaoExtra) como config canonica.
  // Se nenhuma entrada existe ainda: registrar. Se existe mas esta branch e catch-all: sobrescrever.
  // Garante que o mapa representa a config mais abrangente do cenario,
  // independente da ordem das branches no array.
  if (!result[ram.cenarioId] || !ram.condicaoExtra) {
    result[ram.cenarioId] = config;
  }
}
```

- [ ] **Step 4: Rodar os testes para confirmar que todos passam**

```bash
npx vitest run src/engine/__tests__/cenarios.test.ts
```

Esperado: 3 testes passando.

- [ ] **Step 5: Rodar suite completa para garantir nenhuma regressao**

```bash
npm test
```

Esperado: todos os testes passando. Nenhum teste existente usa `CENARIOS['B5']` ou `CENARIOS['B6']` com assert de `[12]` — o comportamento atual ja retornava catch-all por acidente, o fix so o torna explicito.

- [ ] **Step 6: Commit**

```bash
git add src/engine/cenarios.ts src/engine/__tests__/cenarios.test.ts
git commit -m "fix: getCenarios prefere branch catch-all como config canonica por cenarioId

Quando multiplas branches compartilham o mesmo cenarioId (B5, B6), o
mapa retornava a ultima branch iterada por acidente. Agora prefere
explicitamente a branch sem condicaoExtra (catch-all) como canonica.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix `simulator/index.ts` — eliminar map lookup em `gerarObservacoes`

**Context:** `gerarObservacoes` recebe o mapa `cenarios` (com last-branch-wins) e faz lookup por `cenarioId`. A config correta (`resolvido.config`) ja esta disponivel em `simular` — deve ser passada diretamente.

**Files:**
- Modify: `src/simulator/index.ts`

- [ ] **Step 1: Adicionar test em `src/simulator/__tests__/index.test.ts` para garantir que observacoes funcionam com cenario customizado**

Adicionar ao final do arquivo (antes do fechamento do describe ou como novo describe):

```ts
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
```

- [ ] **Step 2: Rodar o teste para confirmar que falha (ou passa — para verificar estado atual)**

```bash
npx vitest run src/simulator/__tests__/index.test.ts
```

Nota: dependendo do estado atual, este teste pode já passar após Task 1 (que corrige o Firebase) ou falhar. Observar o resultado.

- [ ] **Step 3: Atualizar `gerarObservacoes` em `src/simulator/index.ts`**

Substituir a assinatura e corpo da funcao (linhas 112-195):

```ts
// Antes — assinatura:
function gerarObservacoes(
  cenarioId: string,
  params: SimuladorParams,
  derivados: CamposDerivados,
  cenarios: Record<string, CenarioConfig>,
): string[] {
  const obs: string[] = [];
  const cfg = cenarios[cenarioId];

// Depois — assinatura:
function gerarObservacoes(
  cenarioId: string,
  params: SimuladorParams,
  derivados: CamposDerivados,
  cenario: CenarioConfig | undefined,
): string[] {
  const obs: string[] = [];
  const cfg = cenario;
```

O restante do corpo da função permanece idêntico — apenas `cfg` agora aponta para o parâmetro direto.

- [ ] **Step 4: Atualizar `simular` em `src/simulator/index.ts` para remover `getCenarios` e passar `resolvido.config`**

Localizar as linhas 259-295 na função `simular`. Fazer as seguintes substituições:

```ts
// Remover esta linha (linha ~260):
const cenarios = getCenarios(regras);

// Na chamada dentro do bloco if (!cenario) (linha ~281):
// Antes:
observacoes: gerarObservacoes(cenarioId, params, derivados, cenarios),
// Depois:
observacoes: gerarObservacoes(cenarioId, params, derivados, undefined),

// Na chamada principal (linha ~295):
// Antes:
const observacoes = gerarObservacoes(cenarioId, params, derivados, cenarios);
// Depois:
const observacoes = gerarObservacoes(cenarioId, params, derivados, resolvido?.config);
```

- [ ] **Step 5: Remover o import de `getCenarios` em `src/simulator/index.ts` se não mais usado**

Verificar linha 8:
```ts
import { getCenarios } from '../engine/cenarios.ts';
```

Se `getCenarios` não aparece mais no arquivo após remover da função `simular`, remover esta linha de import.

- [ ] **Step 6: Rodar suite completa**

```bash
npm test
```

Esperado: todos os testes passando incluindo o novo teste adicionado no Step 1.

- [ ] **Step 7: Commit**

```bash
git add src/simulator/index.ts src/simulator/__tests__/index.test.ts
git commit -m "fix: gerarObservacoes recebe config resolvida diretamente em vez de map lookup

Eliminado o getCenarios() desnecessario no fluxo simular(). As observacoes
agora usam resolvido.config (a branch que efetivamente ganhou), nao o
mapa flat que retornava a ultima branch por ID.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Fix `SimuladorPage.tsx` — remover default `aplicacao: 'revenda'`

**Context:** `defaultNcmEntry()` inicializa com `aplicacao: 'revenda'`, fazendo com que toda simulação sem seleção explícita caia na branch revenda (com override [12]), ignorando o cenário catch-all.

**Files:**
- Modify: `src/components/SimuladorPage.tsx`

Nota: este é um componente de UI sem testes automatizados. Verificação por inspeção manual após a mudança.

- [ ] **Step 1: Atualizar `NcmEntry` interface e `defaultNcmEntry` em `src/components/SimuladorPage.tsx`**

Localizar linhas 60-69:

```ts
// Antes:
interface NcmEntry {
  ncm: string;
  aplicacao: AplicacaoProduto;
  isCamex: boolean;
  isIcmsSt: boolean;
  autoDetected: boolean;
}

function defaultNcmEntry(): NcmEntry {
  return { ncm: '', aplicacao: 'revenda', isCamex: false, isIcmsSt: false, autoDetected: false };
}

// Depois:
interface NcmEntry {
  ncm: string;
  aplicacao: AplicacaoProduto | undefined;
  isCamex: boolean;
  isIcmsSt: boolean;
  autoDetected: boolean;
}

function defaultNcmEntry(): NcmEntry {
  return { ncm: '', aplicacao: undefined, isCamex: false, isIcmsSt: false, autoDetected: false };
}
```

- [ ] **Step 2: Atualizar o `Select` de aplicacao para incluir "Não informado" como primeira opção**

Localizar a linha ~424 onde está o Select de aplicacao:

```tsx
// Antes:
<Select value={entry.aplicacao} onValueChange={v => updateNcmEntry(idx, 'aplicacao', v as AplicacaoProduto)}>
  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
  <SelectContent>
    {APLICACAO_OPTIONS.map(option => (
      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
    ))}
  </SelectContent>
</Select>

// Depois:
<Select
  value={entry.aplicacao ?? '_none'}
  onValueChange={v => updateNcmEntry(idx, 'aplicacao', v === '_none' ? undefined : v as AplicacaoProduto)}
>
  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="_none">Nao informado</SelectItem>
    {APLICACAO_OPTIONS.map(option => (
      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 3: Atualizar `updateNcmEntry` para aceitar `undefined` no campo aplicacao**

Localizar linhas 237-238 dentro de `updateNcmEntry`:

```ts
// Antes:
} else if (field === 'aplicacao') {
  entries[idx] = { ...entries[idx], aplicacao: value as AplicacaoProduto };
}

// Depois:
} else if (field === 'aplicacao') {
  entries[idx] = { ...entries[idx], aplicacao: value as AplicacaoProduto | undefined };
}
```

- [ ] **Step 4: Verificar que `handleSimular` passa `aplicacao` corretamente (sem mudanca necessaria)**

Localizar linha ~262:
```ts
aplicacao: entry.aplicacao,
```

Este campo já aceita `undefined` pois `SimuladorParams.aplicacao` é `AplicacaoProduto | undefined`. Nenhuma mudança necessária.

- [ ] **Step 5: Rodar suite completa (TypeScript check)**

```bash
npm test
```

Esperado: todos os testes passando. O componente não tem testes unitários — a verificação de tipo do TypeScript durante o build confirma a correção.

- [ ] **Step 6: Commit**

```bash
git add src/components/SimuladorPage.tsx
git commit -m "fix: remover aplicacao 'revenda' como default no simulador

defaultNcmEntry() inicializava com aplicacao='revenda', fazendo toda
simulacao sem selecao explicita cair na branch revenda. Agora inicia
com undefined (catch-all) e o select mostra 'Nao informado'.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Verificação Final

Após todos os tasks:

```bash
npm test
```

Todos os testes devem passar. Validação manual no app:
1. Simulador: SC + Não Contribuinte + sem aplicacao → deve retornar alíquota 17% (ou conforme configuração Firebase do grupo B6)
2. Simulador: mesma config + aplicacao=Revenda → deve retornar alíquota conforme branch revenda configurada
3. Editar grupo B6 no Firebase removendo branches de revenda → simulação deve refletir a config customizada sem fallback para default
