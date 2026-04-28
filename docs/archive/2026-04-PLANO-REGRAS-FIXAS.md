> **⚠️ ARQUIVADO — Status: IMPLEMENTADO (2026-04-23)**
>
> Este plano foi **executado na v3**. Não tomar este arquivo como tarefa em aberto.
>
> Evidências da execução:
> - Diretórios `src/hooks/`, `src/components/regras/config/`, `src/firebase/regrasService.ts` removidos.
> - Regras hardcoded em [`src/data/defaultRegras.ts`](../../src/data/defaultRegras.ts), [`src/data/decreto2128.ts`](../../src/data/decreto2128.ts), [`src/data/cobreAco.ts`](../../src/data/cobreAco.ts).
> - Listas editáveis restringidas a NCM/CNPJ/CAMEX overrides em Firestore ([`src/firebase/configService.ts`](../../src/firebase/configService.ts), [`empresaService.ts`](../../src/firebase/empresaService.ts), [`camexOverrideService.ts`](../../src/firebase/camexOverrideService.ts)).
>
> Fonte de verdade viva: [`RESUMO-COMPLETO-REGRAS-NEGOCIO.md`](../../RESUMO-COMPLETO-REGRAS-NEGOCIO.md) (seções 16–17).

---

# Plano: Regras Fixas + Dados Dinamicos

## TTD 410 — Motor de Auditoria ICMS v3 (Prime Internacional)

**Data:** 2026-04-13
**Versao:** 3.0
**Status:** Proposta para revisao

---

## 1. Problema

As regras tributarias do TTD 410 sao editaveis via UI + Firestore. Isso causou:

- **Incidente real:** usuario clicou "Restaurar Padrao" e a apuracao mudou de R$ 2.399M para R$ 2.641M. O problema estava no `deriveCargaEfetiva` que, ao receber as regras "restauradas", computou cargas erradas para items a 4%.
- **Complexidade desnecessaria:** merge entre Firestore e defaults (`mergeGrupos`), tracking de `deletedIds`, schema compatibility checks, hook `useRegras` com state + sync.
- **Risco operacional:** Prime nao deveria ajustar regras tributarias — isso e trabalho do auditor. Qualquer edicao pode corromper a apuracao silenciosamente.

## 2. Proposta

**Fixar no codigo** toda a logica fiscal (cenarios, aliquotas aceitas, carga efetiva, CSTs, CFOPs).
**Manter editavel** apenas as listas de dados que mudam por decreto ou por cliente.

### O que fica FIXO (hardcoded, somente leitura)

| Componente | Quantidade | Onde vive hoje |
|---|---|---|
| Grupos de cenarios | 15 grupos, 22 ramificacoes | `defaultRegras.ts` → Firestore editavel |
| Vedacoes (V01, V02) | 2 regras | `defaultRegras.ts` → Firestore editavel |
| Config global (ufAliquotas, CFOPs, fundos) | 1 objeto | `defaultRegras.ts` → Firestore editavel |
| Hierarquia de cenarios (A1-A9, B1-B12) | 22 cenarios | Derivados dos grupos acima |

### O que fica EDITAVEL (CadastrosPage + Firestore)

| Lista | Tipo | Muda por | Onde hoje | Usado por |
|---|---|---|---|---|
| `listaCamex` | NCMs | Resolucao CAMEX | `config/ncmLists` | Classifier (isCAMEX) |
| `listaCobreAco` | NCMs | Decreto | `config/ncmLists` | Classifier (isCobreAco), M01 |
| `decreto2128` | NCMs | Decreto 2.128 | `config/ncmLists` | Vedacao V01 |
| `listaVedacao25a` | CNPJs | Por cliente (Pro-Emprego) | `config/cnpjOverrides` | Cenario B9 |
| `listaVedacao25b` | CNPJs | Por cliente (Textil) | `config/cnpjOverrides` | Cenario B10 |
| `listaCD` | CNPJs | Por cliente (Booster) | `config/cnpjOverrides` | Cenario B11 |
| `listaCamex210` | CNPJs | Por cliente (taxa 2,10%) | `config/cnpjOverrides` | Apuracao (carga 2,1% CAMEX) |
| `listaSN` | CNPJs | Derivado de `empresas` | Computado no load | Classifier (tipoDest=sn) |
| `listaIndustriais` | CNPJs | Derivado de `empresas` | Computado no load | Classifier (listaEspecial=industrial) |

**Nota sobre apuracao:** A `listaCamex210` e usada SOMENTE na apuracao TTD para override da carga de 3,6% → 2,1%. As regras de validacao (cenarios, aliquotas) nao mudam.

---

## 3. Mapa Completo de Cenarios (v3)

### 3.1 Saidas Interestaduais (SC → Outra UF)

| Cenario | YAML | Destinatario | CAMEX | Aliquotas | Carga | Fundos | CP | Ref TTD |
|---|---|---|---|---|---|---|---|---|
| **A1** | E01 | Contribuinte, SN | Nao | [4] | 1,0% | 0,4% | Sim | 1.2.a.2 |
| **A2** | E04 | Contribuinte, SN | Sim | [12, 7] | 3,6% | 0,4% | Sim | 1.2.b.2 |
| **A4** | E02 | PJ Nao Contrib | Nao | [4] | 1,0% | 0,4% | Sim | 1.2.a + 1.25 |
| **A5** | E05 | PJ Nao Contrib | Sim | [12, 7] | 3,6% | 0,4% | Sim | 1.2.b.3 |
| **A6** | E02 | Pessoa Fisica | Nao | [4] | 1,0% | 0,4% | Sim | 1.2.a + 1.25 |
| **A7** | E05 | Pessoa Fisica | Sim | [12, 7] | 3,6% | 0,4% | Sim | 1.2.b.3 |
| **A8** | — | Contribuinte (cobre/aco) | Nao | [4] | 0,6% | 0,4% | Sim | 1.2.a.1 |
| **A9** | — | Transferencia | — | [4, 12, 7] | 1,0% | 0,4% | Sim | 1.6 |

*A8 esta INATIVO (v3) — cobre/aco agora e modificador M01, nao cenario separado.*

### 3.2 Saidas Internas (SC → SC)

| Cenario | YAML | Destinatario | CAMEX | Aliquotas | Carga | Fundos | CP | Difer | Ref TTD |
|---|---|---|---|---|---|---|---|---|---|
| **B1** | I01 | Contribuinte | Nao | [4] | 1,0% | 0,4% | Sim | Sim | 1.2.a + 1.13.c |
| **B2** | I10 | Contribuinte | Sim | [12] | 3,6% | 0,4% | Sim | Sim | 1.2.b.2 + 1.13.a |
| **B2-Ind** | I11 | Contribuinte + Industrial | Sim | [12] | 3,6% | 0,4% | Sim | Sim | 1.2.b.2 + 1.2.e + 1.13.a |
| **B3** | I02 | Contribuinte + Industrial | Nao | [10, 4] | 3,6% | 0,4% | Sim | Sim | 1.2.e + 1.13.b |
| **B4** | I03 | SN com ST | Nao | [4] | 1,0% | 0,4% | Sim | Nao | 1.2.a + 1.14.a |
| **B4-CAMEX** | I12 | SN com ST | Sim | [12, 17, 25] | 3,6% | 0,4% | Sim | Nao | 1.2.b.2 |
| **B5** | I04 | SN sem ST | Nao | [12, 17, 25] | 3,6% | 0,4% | Sim | Nao | 1.2.b.1 + 1.14.a |
| **B6** | I05 | PJ Nao Contrib | Nao | [7, 12, 17, 25] | 3,6% | 0,4% | Sim | Nao | 1.2.b.1 + 1.14.b |
| **B6-CAMEX** | I14 | PJ Nao Contrib | Sim | [12, 17, 25] | 3,6% | 0,4% | Sim | Nao | 1.14.b |
| **B7** | V03 | Pessoa Fisica | — | [12, 17, 25] | -1 (integral) | 0 | Nao | Nao | 2.1.c.3 + 1.14.b |
| **B9** | V02 | Vedacao 25a (Pro-Emprego) | — | [] | 0 | 0 | Nao | Sim | 1.14.d + 2.5.a |
| **B10** | — | Vedacao 25b (Textil) | — | [10] | 3,6% | 0,4% | Sim | Sim | 2.5.b |
| **B11** | — | CD Exclusivo (Booster) | — | [10] | 1,0% | 0,4% | Sim | Sim | 1.26 |
| **B12** | — | Transferencia interna | — | [] | -1 (integral) | 0 | Nao | Nao | 2.1.c.2 |

### 3.3 Vedacoes

| Regra | Descricao | Tipo | Fonte | Erro |
|---|---|---|---|---|
| **V01** | NCM no Decreto 2.128 | ncm_prefix | config (decreto2128) | TTD proibido para esta NCM |
| **V01-EXC** | Excecao: interna SC aliq >= 10% | — | — | AVISO (possivel autorizacao especifica) |
| **V02** | Mercadoria usada (CFOP 5922/6922) | cfop_exato | inline | TTD vedado para mercadoria usada |

### 3.4 Modificadores (nao mudam aliquota)

| Regra | Descricao | Efeito | Severidade |
|---|---|---|---|
| **M01** | Aco e cobre (NCM na lista) | Carga cai de 1,0% para 0,6% | INFO |
| **M02** | Reducao de base de calculo | BC reduzida. Apenas observar | INFO |

### 3.5 Config Global

| Parametro | Valor | Observacao |
|---|---|---|
| UF Aliquotas | PR/RJ/RS/SP = 12%, demais = 7% | Res SF 22/89 |
| Aliquotas internas validas | [7, 8.80, 12, 17, 25] | Lei SC |
| CFOPs devolucao | [1201, 1202, 2201, 2202, 5201, 5202, 6201, 6202] | Detecta devolucoes (I09) |
| CFOPs transferencia | [5152, 5155, 6152, 6155] | Detecta transferencias (A9, B12) |
| Fundos padrao | 0,4% | Separado do ICMS |

---

## 4. Regras de Calculo (deriveCargaEfetiva)

A carga efetiva do ICMS a recolher segue regras ABSOLUTAS que nao dependem do cenario:

| Aliquota destacada | Carga efetiva | Excecao |
|---|---|---|
| 0% | 0% | Diferimento total |
| 4% | **1,0%** | Cobre/aco: **0,6%** |
| >= 7% | Cenario.cargaEfetiva (se aliquota casa) ou **3,6%** (fallback) | — |
| Cenario sem CP (carga < 0) | Integral (sem TTD) | B7, B12 |

**Regra critica:** 4% SEMPRE resulta em 1,0% (ou 0,6% cobre/aco), independente do cenario. Foi isso que quebrou a apuracao quando as regras foram "restauradas".

**BC integral:** Recolhimento SEMPRE sobre base integral (vProd + vFrete + vSeg + vOutro - vDesc), nunca sobre vBC reduzida.

### Override CAMEX 2,10%

Na apuracao TTD, a carga pode ser reduzida de 3,6% para 2,1% para CNPJs na `listaCamex210`. Isso e um override de APURACAO, nao de validacao — as regras de cenario nao mudam.

---

## 5. Arquitetura Atual (o que existe hoje)

```
[Firestore]                    [Codigo]
  regras/grupos    ←merge→   defaultRegras.ts (GRUPOS_DEFAULT)
  regras/vedacoes  ←merge→   defaultRegras.ts (VEDACOES_DEFAULT)
  regras/global    ←merge→   defaultRegras.ts (GLOBAL_DEFAULT)
       ↓
  useRegras hook (state + sync)
       ↓
  App.tsx [regras, setRegras]
       ↓
  getCenarios(regras) → {A1: ..., B1: ..., ...}
       ↓
  Engine: classifier → validator → aliquota → apuracao
```

### Arquivos envolvidos

| Arquivo | Responsabilidade | Acao proposta |
|---|---|---|
| `src/types/regras.ts` | Tipos (RegrasConfig, GrupoRegra, etc) | **Manter** (engine usa) |
| `src/data/defaultRegras.ts` | 15 grupos + 2 vedacoes + global | **Manter** como source of truth |
| `src/firebase/regrasService.ts` | CRUD Firestore para regras | **Deletar** |
| `src/hooks/useRegras.ts` | Hook de state + sync com Firestore | **Deletar** |
| `src/engine/cenarios.ts` | Expande grupos → CenarioConfig | **Manter** |
| `src/engine/classifier.ts` | Classifica item em cenario | **Manter** |
| `src/engine/validator.ts` | Valida NF-e item-a-item | **Manter** |
| `src/engine/aliquota.ts` | Valida aliquota vs cenario | **Manter** |
| `src/engine/calculoHelpers.ts` | deriveCargaEfetiva, calculo recolhimento | **Manter** |
| `src/engine/apuracao.ts` | Apuracao mensal | **Manter** |
| `src/engine/apuracaoTTD.ts` | Apuracao TTD com overrides | **Manter** |
| `src/components/RegrasPage.tsx` | Editor completo de regras | **Converter** para somente leitura |
| `src/components/regras/GrupoEditor.tsx` | Editor de grupo | **Deletar** |
| `src/components/regras/VedacaoEditor.tsx` | Editor de vedacoes | **Deletar** |
| `src/components/regras/ConfigGlobalEditor.tsx` | Editor de config global | **Deletar** |
| `src/components/regras/ImportExportPanel.tsx` | Import/export/restaurar | **Deletar** |
| `src/components/regras/QuadroResumoTab.tsx` | Tabela resumo (read-only) | **Manter** |
| `src/App.tsx` | State management principal | **Simplificar** (remover regras state) |
| `src/firebase/configService.ts` | Load de AppConfig (listas NCM/CNPJ) | **Manter** (nao muda) |
| `src/components/CadastrosPage.tsx` | Editor de listas (NCM/CNPJ/Empresas) | **Manter** (nao muda) |

---

## 6. Arquitetura Proposta

```
[Firestore]                         [Codigo]
  config/ncmLists (CAMEX, etc)      defaultRegras.ts → export const REGRAS (frozen)
  config/cnpjOverrides (25a, etc)          ↓
  empresas/ (SN, Industrial)        getCenarios(REGRAS) → CENARIOS (pre-computado)
       ↓                                   ↓
  loadFullAppConfig()               Engine: classifier → validator → apuracao
       ↓                                   ↑
  AppConfig (listas)  ──────────────────────┘
```

### Mudancas por fase

**Fase 1 — Constante REGRAS (risco zero)**
- `defaultRegras.ts`: exportar `REGRAS` como constante frozen (deepFreeze)
- `cenarios.ts`: atualizar `CENARIOS` para usar `REGRAS`

**Fase 2 — Simplificar engine (risco zero)**
- 7 arquivos engine: substituir pattern `getDefaults()` lazy por import direto de `REGRAS`
- Remover blocos `_defaultRegras` / `getDefaults()` de cada arquivo

**Fase 3 — Remover Firestore regras (mudanca critica)**
- `App.tsx`: remover `[regras, setRegras]`, importar `REGRAS`, remover load Firestore
- Deletar `regrasService.ts`, `useRegras.ts`

**Fase 4 — RegrasPage somente leitura**
- Converter RegrasPage para exibicao sem edicao
- Manter: Quadro Resumo, Legenda, Cenarios (visualizacao)
- Remover: tabs Configuracoes, Importar/Exportar
- Deletar: GrupoEditor, VedacaoEditor, ConfigGlobalEditor, ImportExportPanel

**Fase 5 — Limpar prop threading (opcional)**
- Remover `regras` prop de ~12 componentes
- Cada componente importa `REGRAS` direto

**Fase 6 — Sidebar e verificacao**
- Renomear "Regras" para "Referencia TTD" na sidebar
- Rodar testes (306+ passando) + build + verificar apuracao

---

## 7. O que NAO muda

- **Listas de dados** (NCM/CNPJ) continuam editaveis via CadastrosPage
- **Empresas** (SN, Industrial) continuam editaveis via CadastrosPage
- **Override CAMEX 2,10%** (`listaCamex210`) continua editavel na apuracao
- **Overrides manuais** na apuracao TTD (por NF, por par CNPJ+NCM) continuam funcionando
- **Todos os testes do engine** continuam passando (types preservados)
- **Tipos TypeScript** (`RegrasConfig`, `GrupoRegra`, etc) preservados para compatibilidade

---

## 8. Verificacao pos-implementacao

1. `npx vitest run` — 306+ testes passando, 0 regressoes
2. `npm run build` — build limpo
3. Importar XMLs de marco/2026 e conferir:
   - Apuracao = R$ 2.399M (valor de referencia)
   - Cenarios classificados corretamente
   - Listas NCM/CNPJ editaveis no CadastrosPage
4. Confirmar que RegrasPage exibe regras sem permitir edicao
5. Confirmar que "Restaurar Padrao" nao existe mais

---

## 9. Riscos e mitigacao

| Risco | Probabilidade | Mitigacao |
|---|---|---|
| Apuracao muda apos refatoracao | Baixa (types preservados) | Comparar valor antes/depois com mesmos XMLs |
| Componente quebra sem prop `regras` | Media (12+ componentes) | Fazer fase 5 por ultimo, testar cada componente |
| Perda de regras customizadas no Firestore | N/A | Nao existem customizacoes — Prime usa defaults |
| Necessidade futura de editar regras | Baixa | Mudanca no codigo + deploy (auditor decide, dev implementa) |
