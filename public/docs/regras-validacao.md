# ICMS Auditor v3 — Regras de Validação

> Atualizado em: 2026-04-23 | Versão: 3.0
> Cobertura: 22 cenários (A1–A7, A9, B1–B12) + validações de BC, CP, InfCpl, alíquota, CST, CFOP, vedações e cross-checks.

---

## Níveis de Severidade

| Tipo | Valores | Significado |
|------|---------|-------------|
| **Regras** | `OK` / `INFO` / `AVISO` / `DIVERGENCIA` / `ERRO` | Resultado da validação do item |
| **Cross-checks** | `ok` / `atencao` / `divergente` | Severidade de cada verificação complementar |

> Terminologia antiga `ALERTA` foi substituída por `AVISO` na v3. Consulte [`src/types/validation.ts`](../../src/types/validation.ts) para o tipo oficial.

---

## Cenários

- **Série A (interestaduais)**: A1–A7, A9 — A8 (cobre/aço contribuinte) foi desativado na v3 e virou modificador M01 sobre A1.
- **Série B (internas SC)**: B1–B12.
- **Referência completa**: [RESUMO-COMPLETO-REGRAS-NEGOCIO.md](../../RESUMO-COMPLETO-REGRAS-NEGOCIO.md).

---

## 1. Regras de Alíquota (AL)

**Arquivo:** `src/engine/aliquota.ts`

| Código | Status | Descrição | Condição |
|--------|--------|-----------|----------|
| AL00 | OK | Cenário sem alíquota esperada (diferimento/transferência) | `aliquotasAceitas.length === 0` |
| AL01 | OK | Alíquota conforme cenário | Alíquota confere com `aliquotasAceitas` |
| AL01 | ERRO | Alíquota diverge do esperado para o cenário | Alíquota diverge + (tem CP ou < 12%) |
| AL02 | AVISO | Alíquota aceita mas cross-checks com divergências | Alíquota confere + `hasJustification === false` |
| AL06 | AVISO | 4% válido mas opção 10% disponível (mais crédito) | Cenário B3 + alíquota 4% |
| AL07 | AVISO | 17% aceita porém justificativa somente por SN | 17% + SN é a única justificativa |
| AL08 | AVISO | Alíquota confere mas sem crédito presumido informado | ≥12% + sem CP + `cenario.temCP` + BC não reduzida |
| AL09 | AVISO | Alíquota diverge mas sem CP — possível não uso do TTD | Alíquota diverge + ≥12% + sem CP |

---

## 2. Regras de Vedação (V)

**Arquivo:** `src/engine/vedacoes.ts`

| Código | Status | Descrição | Condição |
|--------|--------|-----------|----------|
| V01 | ERRO | NCM vedada pelo Decreto 2.128 — TTD não pode ser aplicado | NCM ∈ `config.decreto2128` |
| V01-EXC | AVISO | NCM no Decreto 2.128 mas operação interna SC sem CP | NCM ∈ decreto2128 + SC×SC + ≥12% + sem CP |
| V02 | ERRO | TTD vedado para mercadoria usada | CFOP ∈ {5922, 6922} |

---

## 3. Regras de CST

**Arquivo:** `src/engine/cst.ts`

| Código | Status | Descrição | Condição |
|--------|--------|-----------|----------|
| CST01 | OK | CST OK — origem de importador válida | Origem ∈ {1, 6, 7} |
| CST02 | AVISO | CST origem inesperada — pode indicar mercadoria nacional | Origem ∉ {1, 6, 7} |
| CST03 | AVISO | ST detectada em cenário que não espera ST | Tribut. = 10 + cenário sem ST |
| CST04 | AVISO | Redução de BC (CST 20) — verificar se correto | Tribut. = 20 |

---

## 4. Regras de CFOP (CF)

**Arquivo:** `src/engine/cfop.ts`

| Código | Status | Descrição | Condição |
|--------|--------|-----------|----------|
| CF00 | OK | CFOP não validado para este cenário | `cfopsEsperados.length === 0` |
| CF01 | OK | CFOP conforme cenário | CFOP ∈ `cfopsEsperados` |
| CF01 | AVISO | CFOP não é padrão para o cenário | CFOP ∉ lista + não é conta/ordem nem venda |
| CF02 | OK | CFOP de conta e ordem — sempre aceito | CFOP termina em 49 |
| CF03 | OK | CFOP de venda — aceito | CFOP termina em 02 |

---

## 5. Regras de Base de Cálculo (BC)

**Arquivo:** `src/engine/bcValidation.ts`

Valida se `vBC` confere com `vProd + vFrete + vSeg + vOutro - vDesc` (respeitando redução de BC quando aplicável). Divergências são sinalizadas como `DIVERGENCIA` ou `AVISO`.

---

## 6. Regras de Crédito Presumido (CP)

**Arquivo:** `src/engine/cpValidation.ts`

Recalcula o CP esperado para o cenário (alíquota, carga efetiva, fundos) e compara com o efetivamente informado na NF-e/escrituração. Divergências `> 0.01` viram `DIVERGENCIA`.

---

## 7. Regras de InfCpl

**Arquivo:** `src/engine/infCplValidation.ts`

Valida o texto livre em `infCpl`: menção ao TTD 410, CST declarado, valores de BC e CP. Inconsistências textuais viram `AVISO`; ausência de TTD em operação que deveria aplicá-lo vira `DIVERGENCIA`.

---

## 8. Regras de Fluxo (I/C)

**Arquivo:** `src/engine/validator.ts`

| Código | Status | Descrição | Condição |
|--------|--------|-----------|----------|
| I09 | AVISO | Devolução detectada — estornar CP (item 1.20), creditar fundos via DCIP 54 | Cenário = DEVOLUÇÃO |
| C-UNK | AVISO | Cenário não identificado — verificar manualmente | Nenhum cenário classificado |

---

## 9. Cross-Checks: Alíquota 12% (CK12)

**Lógica:** OR entre CK12A/B/C (basta 1 passar) + AND em CK12D (obrigatória)

| Código | Lógica | Verificação | Condição |
|--------|--------|-------------|----------|
| CK12A | OR | CST origem = 6 (CAMEX)? | `item.cstOrig === '6'` |
| CK12B | OR | NCM na lista CAMEX? | NCM ∈ `config.listaCamex` |
| CK12C | OR | Dest. é Simples Nacional? | CNPJ ∈ `config.listaSN` |
| CK12D | AND | Dest. NÃO é não-contribuinte? | `!isNaoContribuinte(dest)` |

---

## 10. Cross-Checks: Alíquota 10% (CK10)

**Lógica:** AND obrigatórias + OR para industrial no cenário B3

| Código | Lógica | Verificação | Condição |
|--------|--------|-------------|----------|
| CK10A | AND | Remessa interna (SC → SC)? | `dest.uf === 'SC'` |
| CK10B | OR(B3) / AND | Dest. na lista de industriais? | CNPJ ∈ `config.listaIndustriais` |
| CK10E | OR(B3) | CNAE de atividade industrial? | CNAE principal indica indústria |
| CK10C | AND | Dest. NÃO é Simples Nacional? | CNPJ ∉ `config.listaSN` |
| CK10D | AND | Dest. NÃO é não-contribuinte? | `!isNaoContribuinte(dest)` |

---

## 11. Cross-Checks: Alíquota 4% (CK04)

**Lógica:** Todas AND (obrigatórias)

| Código | Lógica | Verificação | Condição |
|--------|--------|-------------|----------|
| CK04A | AND | Dest. NÃO é SN? (exceto B4) | `!isSN \|\| cenario B4` |
| CK04B | AND | CST origem ≠ 6 (se CAMEX, deveria ser 12%)? | `cstOrig !== '6'` |
| CK04C | AND | CST origem = 1 (importado com similar)? | `cstOrig === '1'` |

---

## 12. Cross-Checks: Alíquota 17% (CK17)

**Lógica:** OR (precisa ao menos 1 justificativa). SN sozinho = justificativa fraca (AL07)

| Código | Lógica | Verificação | Condição |
|--------|--------|-------------|----------|
| CK17A | OR | BC é reduzida? | CST 20 \|\| pRedBC > 0 \|\| vBC < vProd×0.98 |
| CK17B | OR (fraco) | Dest. é Simples Nacional? | CNPJ ∈ `config.listaSN` |
| CK17C | OR | Dest. é não-contribuinte? | `isNaoContribuinte(dest)` |

---

## Funções Auxiliares

| Função | Lógica |
|--------|--------|
| `isNaoContribuinte(dest)` | `indIEDest='9'` OU IE ausente/vazia OU IE=`'ISENTA'`/`'ISENTO'` |
| `isBCReduzida(item)` | CST tribut.=20 OU `pRedBC > 0` OU `vBC < vProd × 0.98` |
| `isCAMEX(item)` | `cstOrig='6'` OU NCM ∈ `listaCamex` |
| `checkIndustrial(cnae)` | Apenas CNAE **principal** (não secundários) |

---

## Fluxo de Validação por Item

```
Item XML
  │
  ├─► Vedações (V01, V01-EXC, V02)
  │     └─ Se ERRO → VEDADO (para aqui)
  │
  ├─► Classificação do Cenário (A1–A7, A9, B1–B12)
  │     └─ Se não encontrado → C-UNK / I09 (devolução)
  │
  ├─► Validação de Alíquota (AL00–AL09)
  │     └─ Cross-Checks (CK12, CK10, CK04, CK17)
  │
  ├─► Validação de CST (CST01–CST04)
  │
  ├─► Validação de CFOP (CF00–CF03)
  │
  ├─► Validação de BC (bcValidation)
  │
  ├─► Validação de CP (cpValidation)
  │
  └─► Validação de InfCpl (infCplValidation)
```
