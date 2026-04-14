# ICMS Auditor — Resumo Completo de Regras de Negócio e Arquitetura

## 1. VISÃO GERAL

O ICMS Auditor é um motor de conformidade fiscal que valida operações ICMS em documentos NF-e (Nota Fiscal Eletrônica), focado no **TTD 410** (Tratamento Tributário Diferenciado) do estado de **Santa Catarina**.

**Objetivo**: Auditar XMLs de NF-e, classificar cada item em um cenário tributário, validar alíquotas/CST/CFOP, calcular ICMS a recolher, fundos sociais e crédito presumido.

**Stack**: React + TypeScript + Vite + Firebase (Firestore) + Tailwind CSS

---

## 2. FLUXO COMPLETO DE PROCESSAMENTO

```
XML Upload → parseNfe() → validarNfe() → Dashboard/Export
                              │
                              ├── 1. verificarVedacoes()     → ERRO (bloqueante) ou AVISO
                              ├── 2. computarCamposDerivados() → 8 flags derivados
                              ├── 3. classificarCenario()     → cenarioId (A1..A9, B1..B12, VEDADO, DEVOLUCAO, DESCONHECIDO)
                              ├── 4. validarAliquota()        → OK/INFO/AVISO/DIVERGENCIA/ERRO + cross-checks
                              ├── 5. validarCST()             → OK/INFO/AVISO/DIVERGENCIA
                              └── 6. validarCFOP()            → OK/AVISO
```

---

## 3. CAMPOS DERIVADOS (computados automaticamente)

Para cada item da NF-e, o engine calcula 8 campos derivados:

| Campo | Lógica |
|-------|--------|
| `operacao` | 'interestadual' se dest.uf ≠ 'SC', senão 'interna' |
| `tipoDest` | 'pf' (tem CPF, sem CNPJ) → 'pj_nc' (indIEDest=9 ou IE vazia) → 'sn' (CNPJ na listaSN) → 'contribuinte' (indIEDest=1) → 'desconhecido' |
| `isCAMEX` | cstOrig='6' OU NCM prefixo na listaCamex |
| `isCobreAco` | NCM prefixo na listaCobreAco |
| `temST` | CST tributação em ['10', '30', '60', '70'] |
| `cfopMatch` | 'devolucao' se CFOP em cfopsDevolucao; 'transferencia' se em cfopsTransferencia |
| `listaEspecial` | vedacao25a → vedacao25b → cd → industrial (prioridade, primeira que casar) |
| `aplicacao` | null no auditor (aceita qualquer); no simulador: revenda/industrializacao/uso_consumo/ativo_permanente |

---

## 4. CENÁRIOS TRIBUTÁRIOS — TODOS OS 22 CENÁRIOS

### 4.1 Série A — Interestaduais (SC → outra UF)

| Cenário | Nome | Destinatário | CAMEX | Aliq. Aceitas | Carga Efetiva | Fundos | CP | CST | CFOPs | Ref TTD |
|---------|------|-------------|-------|---------------|---------------|--------|----|----|-------|---------|
| **A1** | Contrib/SN sem CAMEX | contribuinte, sn | Não | 4% | 1,0% | 0,4% | Sim | 90 | 6101,6102,6106,6107 | 1.2.a.2 |
| **A2** | Contrib/SN com CAMEX | contribuinte, sn | Sim | 12%, 7% | 3,6% | 0,4% | Sim | 90 | 6101,6102,6106,6107 | 1.2.b.2 |
| **A4** | PJ NC sem CAMEX | pj_nc | Não | 4% | 1,0% | 0,4% | Sim | 90 | 6101,6102,6107,6108 | 1.2.a + 1.25 |
| **A5** | PJ NC com CAMEX | pj_nc | Sim | 12%, 7% | 3,6% | 0,4% | Sim | 90 | 6101,6102,6107,6108 | 1.2.b.3 |
| **A6** | PF sem CAMEX | pf | Não | 4% | 1,0% | 0,4% | Sim | 90 | 6101,6102,6107,6108 | 1.2.a + 1.25 |
| **A7** | PF com CAMEX | pf | Sim | 12%, 7% | 3,6% | 0,4% | Sim | 90 | 6101,6102,6107,6108 | 1.2.b.3 |
| **A8** | Cobre/Aço contribuinte | contribuinte | Não | 4% | **0,6%** | 0,4% | Sim | 90 | 6101,6102,6106,6107 | 1.2.a.1 |
| **A9** | Transferência interestadual | qualquer | — | 4%, 12%, 7% | 1,0% | 0,4% | Sim | 90 | 6152,6155 | 1.6 |

### 4.2 Série B — Internas (SC → SC)

| Cenário | Nome | Destinatário | CAMEX | Aliq. Aceitas | Carga Efetiva | Fundos | CP | CST | CFOPs | Ref TTD |
|---------|------|-------------|-------|---------------|---------------|--------|----|----|-------|---------|
| **B1** | Contribuinte padrão | contribuinte | Não | 4% | 1,0% | 0,4% | Sim | 51 | 5101,5102,5106,5107 | 1.2.a + 1.13.c |
| **B2** | Contribuinte CAMEX | contribuinte | Sim | 12% | 3,6% | 0,4% | Sim | 51 | 5101,5102,5106,5107 | 1.2.b.2 + 1.13.a |
| **B3** | Industrial (MP c/ mudança NCM) | contribuinte + industrial | Não | 10%, 4% | 3,6% | 0,4% | Sim | 51 | 5101,5102,5106,5107 | 1.2.e + 1.13.b |
| **B4** | SN com ST sem CAMEX | sn + ST | Não | 4% | 1,0% | 0,4% | Sim | 10, 70 | 5101,5102,5106,5107 | 1.2.a + 1.14.a |
| **B4-CAMEX** | SN com ST com CAMEX | sn + ST | Sim | 12% | 3,6% | 0,4% | Sim | 10, 70 | 5101,5102,5106,5107 | 1.2.b.2 |
| **B5** | SN sem ST (revenda/ind) | sn, sem ST | — | 12% | 3,6% | 0,4% | Sim | 00 | 5101,5102,5106,5107 | 1.2.b.1 + 1.14.a |
| **B5** | SN sem ST (catch-all) | sn, sem ST | — | 7,8.80,12,17,25 | 3,6% | 0,4% | Sim | 00 | 5101,5102,5106,5107 | 1.2.b.1 + 1.14.a |
| **B6** | PJ NC (revenda/ind) | pj_nc | — | 12% | 3,6% | 0,4% | Sim | 00 | 5101,5102,5106,5107 | 1.2.b.1 + 1.14.b |
| **B6** | PJ NC (catch-all) | pj_nc | — | 7,8.80,12,17,25 | 3,6% | 0,4% | Sim | 00 | 5101,5102,5106,5107 | 1.2.b.1 + 1.14.b |
| **B7** | Pessoa Física (consumidor) | pf | — | 7,8.80,12,17,25 | **-1 (N/A)** | **0** | **Não** | 00 | 5101,5102,5106,5107 | 2.1.c.3 + 1.14.b |
| **B9** | Pro-Emprego (vedação 25a) | vedacao25a | — | (vazio) | **0** | **0** | **Não** | 51 | 5101,5102,5106,5107 | 1.14.d + 2.5.a |
| **B10** | Têxtil/Confecções (ved. 25b) | vedacao25b | — | 10% | 3,6% | 0,4% | Sim | 51 | 5101,5102,5106,5107 | 2.5.b |
| **B11** | CD Exclusivo (Booster) | cd | — | 10% | 1,0% | 0,4% | Sim | 51 | 5101,5102,5106,5107 | 1.26 |
| **B12** | Transferência interna (filial) | qualquer | — | (vazio) | **-1 (diferido)** | **0** | **Não** | 51 | 5152,5155 | 2.1.c.2 |

### 4.3 Cenários Especiais (não configuráveis)

| Cenário | Trigger | Comportamento |
|---------|---------|---------------|
| **DEVOLUCAO** | cfopMatch = 'devolucao' | Estornar CP (item 1.20 TTD). Fundos: creditar via DCIP 54 |
| **VEDADO** | Qualquer vedação retorna ERRO | Item bloqueado, TTD não se aplica |
| **DESCONHECIDO** | Nenhum grupo casa | Verificar manualmente. Status DIVERGENCIA |

---

## 5. FÓRMULAS DE CÁLCULO DO ICMS

### 5.1 Quando TTD se aplica (cargaEfetiva > 0 E temCP = true):
```
ICMS a Recolher = BC × (cargaEfetiva / 100)
Crédito Presumido = alíquota_destacada - cargaEfetiva
Fundos Sociais = BC × (0,4 / 100)
Total a Pagar = ICMS a Recolher + Fundos
```

### 5.2 Quando TTD se aplica mas SEM CP (temCP = false):
```
ICMS a Recolher = BC × (alíquota_destacada / 100)   ← INTEGRAL
Crédito Presumido = 0
Fundos Sociais = BC × (0,4 / 100)
Total a Pagar = ICMS a Recolher + Fundos
```

### 5.3 Quando TTD NÃO se aplica (cargaEfetiva < 0, ex: PF, transferência):
```
ICMS a Recolher = BC × (alíquota_destacada / 100)   ← INTEGRAL
Crédito Presumido = 0
Fundos Sociais = 0
Total a Pagar = ICMS a Recolher
```

### 5.4 Override Cobre/Aço:
```
Se isCobreAco E pICMS ≈ 4%:
  cargaEfetiva = 0,6% (em vez de 1,0%)
```

### 5.5 CAMEX Interestadual (alíquota por UF):
```
PR, RJ, RS, SP → 12%
Demais UFs → 7%
```

### 5.6 CAMEX — Comparativo 3,6% vs 2,1%:
O Dashboard calcula ambos cenários para itens CAMEX 12%:
- Normal: carga 3,6% → recolher = BC × 3,6%
- Alternativo: carga 2,1% → recolher = BC × 2,1%

---

## 6. REGRAS DE VALIDAÇÃO — SEVERIDADES

### 6.1 Vedações (Bloqueantes)

| Regra | Tipo | Condição | Status | Exceção |
|-------|------|----------|--------|---------|
| V01 | NCM Prefix | NCM no Decreto 2.128 | **ERRO** | Se interna SC + alíq ≥12% + sem CP → **AVISO** |
| V02 | CFOP Exato | CFOP 5922 ou 6922 (mercadoria usada) | **ERRO** | — |

### 6.2 Alíquota

| Regra | Status | Condição |
|-------|--------|----------|
| AL00 | OK | Alíquota não validada (diferimento/transferência) |
| AL01 | **OK** | Alíquota conforme cenário |
| AL01 | **ERRO** | Alíquota diverge do cenário (sem justificativa) |
| AL02 | **DIVERGENCIA** | Alíquota aceita mas cross-checks falham |
| AL06 | INFO | 4% válido mas 10% disponível (mais crédito) |
| AL07 | AVISO | 17% justificado apenas por SN |
| AL08 | AVISO | 12%+ sem crédito presumido (cenário espera CP) |
| AL09 | INFO | Alíquota errada mas sem CP → possível não-uso do TTD |

### 6.3 CST

| Regra | Status | Condição |
|-------|--------|----------|
| CST01 | OK | CST origem 1, 6 ou 7 |
| CST02 | AVISO | Origem não é 1/6/7 (mercadoria nacional?) |
| CST03 | **DIVERGENCIA** | CST tributação 10 (ST) quando cenário não espera |
| CST04 | INFO | CST tributação 20 (redução BC) |
| CST05 | AVISO | NCM CAMEX mas CST origem = 1 (contradição) |

### 6.4 CFOP

| Regra | Status | Condição |
|-------|--------|----------|
| CF00 | OK | CFOP não validado (lista vazia) |
| CF01 | OK | CFOP na lista esperada |
| CF01 | AVISO | CFOP fora da lista esperada |
| CF02 | OK | CFOP final 49 (conta e ordem) |
| CF03 | OK | CFOP final 02 (venda) |

### 6.5 Hierarquia de Severidade
```
ERRO > DIVERGENCIA > AVISO > INFO > OK
```
O statusFinal do item é o MAIS GRAVE entre todos os resultados.

---

## 7. CROSS-CHECKS (Verificações Cruzadas)

### 7.1 Cross-checks para 12% (CK12A-D)
- **CK12A** (OR): CST origem = 6 (CAMEX direto)
- **CK12B** (OR): NCM na lista CAMEX
- **CK12C** (OR): Destinatário Simples Nacional
- **CK12D** (AND): Destinatário NÃO é não-contribuinte

Justificado se: CK12D ok E pelo menos um OR passou

### 7.2 Cross-checks para 10% (CK10A-E)
- **CK10A** (AND): Operação interna (SC→SC)
- **CK10C** (AND): Destinatário NÃO é Simples Nacional
- **CK10D** (AND): Destinatário NÃO é não-contribuinte
- **CK10E** (OR, se cenário industrial): É industrial por lista OU por CNAE

### 7.3 Cross-checks para 4% (CK04A-C)
- **CK04A** (AND): Destinatário NÃO é SN (exceto cenário B4)
- **CK04B** (AND): CST origem ≠ 6 (não é CAMEX direto)
- **CK04C** (AND): CST origem = 1 (importado com similar)

### 7.4 Cross-checks para 17% (CK17A-C)
- **CK17A** (OR): BC reduzida (CST 20 ou pRedBC > 0)
- **CK17B** (OR): Destinatário Simples Nacional (se único → só "atenção")
- **CK17C** (OR): Destinatário não-contribuinte

---

## 8. LISTAS CONFIGURÁVEIS

| Lista | Fonte | Uso |
|-------|-------|-----|
| decreto2128 | Firebase config/ncmLists | NCMs vedadas pelo Decreto 2.128 |
| listaCamex | Firebase config/ncmLists | NCMs sem similar nacional |
| listaCobreAco | Firebase config/ncmLists | NCMs de cobre/aço (carga 0,6%) |
| listaSN | Derivada de empresas (simplesOptante=true) | CNPJs Simples Nacional |
| listaIndustriais | Derivada de empresas (isIndustrial=true) | CNPJs industriais (10%) |
| listaCD | Firebase config/cnpjOverrides | CNPJs CD Exclusivo |
| listaVedacao25a | Firebase config/cnpjOverrides | CNPJs Pró-Emprego |
| listaVedacao25b | Firebase config/cnpjOverrides | CNPJs Têxtil/Confecções |

### 8.1 Alíquotas Interestaduais por UF
| UF | Alíquota |
|----|----------|
| PR, RJ, RS, SP | 12% |
| Demais | 7% |

### 8.2 Alíquotas Internas Válidas
`[7, 8.80, 12, 17, 25]`

### 8.3 CFOPs de Devolução
`1201, 1202, 2201, 2202, 5201, 5202, 6201, 6202`

### 8.4 CFOPs de Transferência
`5152, 5155, 6152, 6155`

### 8.5 NCMs Decreto 2.128 (27 prefixos)
```
7005, 7007, 7009, 9607, 8903, 691110, 7013, 220710,
2710125, 2710191, 2710192, 2710193, 2710199, 27109, 2711,
38260000, 3403, 27101230, 1604, 54024400, 54041100, 84515020,
2710124, 73071910, 73071990
```

---

## 9. CLASSIFICAÇÃO INDUSTRIAL (CNAE)

Uma empresa é considerada **industrial** se a divisão CNAE (2 primeiros dígitos) está entre:
- 05-09 (indústrias extrativas)
- 10-33 (indústrias de transformação)

Override manual possível via Firebase (`industrialOverride` no cadastro).

---

## 10. CONFIANÇA

| Nível | Condição |
|-------|----------|
| **alta** | statusFinal = OK, todos cross-checks ok |
| **media** | statusFinal AVISO ou INFO, ou cross-check "atenção" |
| **baixa** | statusFinal ERRO ou DIVERGENCIA, ou cross-check "divergente" |

---

## 11. RECONCILIAÇÃO (DIME)

Agrupa itens por **refTTD** e calcula totais:
- Total BC, ICMS Destacado, ICMS a Recolher (BC × cargaEfetiva), Fundos, Total
- Flag de divergência se algum item tem ERRO ou DIVERGENCIA
- Também agrupa por código de Crédito Presumido (cCredPresumido)

---

## 12. EXPORTAÇÃO EXCEL

7 abas:
1. **Resumo** — Visão por NF-e com totais
2. **Detalhamento** — Todos os itens com validações
3. **CST-XX** — Uma aba por CST (filtrada)
4. **Regras** — Log de todas as validações executadas
5. **Fundos e Totais** — Resumo financeiro por NF-e
6. **Reconciliação DIME** — Agrupado por TTD ref
7. **Crédito Presumido** — Agrupado por código CP

---

## 13. OBSERVAÇÕES DO SIMULADOR

| Cenário | Observação |
|---------|-----------|
| B3 | "Opção 10% para industrial. Obriga comunicação formal ao destinatário (item 1.19 TTD)." |
| B7 | "PF consumidor final — ICMS integral, SEM crédito presumido." |
| B9 | "Destinatário com TTD/diferimento (Pró-Emprego) — CP vedado (art. 246, §6º, IV)." |
| B10 | "Destinatário têxtil/confecções (art. 15, XXXIX) — obrigatório 10%." |
| B11 | "CD Exclusivo (Booster) — enviar comunicação ao CD." |
| B12 | "Transferência interna para filial SC — diferido, sem CP." |
| A8 | "Cobre/Aço — carga efetiva 0,6% (não 1,0%)." |
| A9 | "Transferência interestadual — equivale a comercialização (art. 246, §17). CP se aplica." |
| DEVOLUCAO | "Estornar CP (item 1.20 TTD). Fundos: creditar via DCIP 54." |
| DESCONHECIDO | "Cenário não identificado — verificar manualmente." |
| Fundos > 0 | "Fundos 0,4% sobre BC integral (FUMDES + FIA — Portaria SEF 143/2022)." |
| CAMEX inter | "Alíquota interestadual 12% (PR/RJ/RS/SP) ou 7% conforme UF." |

---

## 14. PRIORIDADE DOS GRUPOS (Matching)

A classificação avalia grupos em ORDEM de prioridade (menor = primeiro):

```
Prio 2:  G-TRANSF-INTER      (transferência interestadual)
Prio 3:  G-TRANSF-INTERNA     (transferência interna)
Prio 10: G-INTER-PJNC         (interestadual PJ não contribuinte)
Prio 12: G-INTER-PF           (interestadual PF)
Prio 14: G-INTER-COBREACO     (cobre/aço interestadual)
Prio 15: G-INTER-CONTRIB      (interestadual contribuinte/SN)
Prio 20: G-INTERNA-VED25A     (interna vedação 25a)
Prio 21: G-INTERNA-VED25B     (interna vedação 25b)
Prio 22: G-INTERNA-CD         (interna CD exclusivo)
Prio 30: G-INTERNA-PF         (interna PF)
Prio 31: G-INTERNA-PJNC       (interna PJ NC)
Prio 40: G-INTERNA-SN-ST      (interna SN com ST)
Prio 42: G-INTERNA-SN-SEMST   (interna SN sem ST)
Prio 50: G-INTERNA-CONTRIB    (interna contribuinte normal)
```

Dentro de cada grupo, ramificações também são avaliadas por prioridade + especificidade.

---

## 15. EDGE CASES E OVERRIDES HARDCODED

1. **Cobre/Aço 4%**: Override de cargaEfetiva para 0,6% (em validator.ts E exportExcel.ts)
2. **DEVOLUCAO**: Detectado por cfopMatch, não-configurável
3. **CAMEX interestadual**: Alíquota determinada por UF destino, não pela config do cenário
4. **BC Reduzida**: CST 20 ou pRedBC > 0 justifica 17% sem outras condições
5. **SN como única justificativa para 17%**: Downgrade para AVISO (não DIVERGENCIA)
6. **Tolerância de comparação**: Math.abs(diff) < 0.01 para floating point
7. **Simulador sem aplicação**: Não pode casar ramificações que exigem aplicação específica
8. **Fallback de carga por alíquota** (exportExcel): 4%→1%, 10/12/7/17/25%→3.6%, outro→0%

---

## 16. ESTRUTURA DE ARQUIVOS

```
src/engine/
├── validator.ts       → Orquestrador principal (5 estágios)
├── classifier.ts      → Classificação de cenário (campos derivados + matching)
├── aliquota.ts        → Validação de alíquota + cross-checks
├── cst.ts             → Validação de CST
├── cfop.ts            → Validação de CFOP
├── vedacoes.ts        → Regras bloqueantes
├── cenarios.ts        → Expansão de regras em mapa de cenários
├── reconciliacao.ts   → Agregação para DIME
├── cnpjService.ts     → Consulta CNPJ (OpenCNPJ/CNPJa)
└── parser.ts          → Parse de XML NF-e

src/simulator/
├── index.ts           → Motor do simulador
└── calculator.ts      → Cálculos TTD (fórmulas)

src/types/
├── validation.ts      → StatusType, ValidationResult, ItemValidation, NfeValidation
├── regras.ts          → GrupoRegra, Ramificacao, VedacaoRule, RegrasConfig
├── cenario.ts         → CenarioConfig
├── config.ts          → AppConfig
└── nfe.ts             → NfeData, ItemData, DestData

src/data/
├── defaultRegras.ts   → Regras padrão completas (15 grupos, 22 cenários)
├── decreto2128.ts     → NCMs vedadas (27 prefixos)
├── cobreAco.ts        → Helper para cobre/aço
└── aliquotasInternas.ts → Alíquotas internas válidas [7, 8.80, 12, 17, 25]

src/firebase/
├── regrasService.ts   → Persistência de regras (Firestore)
└── configService.ts   → Persistência de config + empresas

src/utils/
└── exportExcel.ts     → Exportação Excel (7 abas)
```

---

## 17. O QUE É CONFIGURÁVEL vs HARDCODED

### Configurável (via UI Regras):
- Grupos de regras (condições, prioridade, ativo/inativo)
- Ramificações (cenarioId, condições extras, override de valores)
- Valores esperados (alíquotas, CST, CFOP, cargaEfetiva, fundos, CP, refTTD)
- Vedações (NCM prefix, CFOP exato, condições operacionais)
- Config global (ufAliquotas, CFOPs devolução/transferência, fundos padrão)

### Configurável (via UI Cadastros):
- Listas NCM (Decreto 2.128, CAMEX, Cobre/Aço)
- CNPJs especiais (vedação 25a, 25b, CD exclusivo)
- Override industrial por empresa

### HARDCODED (no código):
- Severidades das validações (ERRO vs AVISO vs DIVERGENCIA)
- Lógica dos cross-checks (CK12, CK10, CK04, CK17)
- Override cobre/aço 4% → 0,6%
- Detecção de devolução por CFOP
- Classificação industrial por CNAE (divisões 05-33)
- Tolerância de comparação (0.01)
- Fluxo de validação (5 estágios em sequência)

---

## 18. GAPS CONHECIDOS PARA 100% DE ACURÁCIA

1. **Severidades não-configuráveis**: O nível de erro (ERRO vs AVISO) está hardcoded — não pode ser ajustado por cenário
2. **Sem validação de valor total**: Não compara vICMS calculado vs vICMS declarado na NF-e
3. **Sem validação de BC**: Não verifica se BC está correto em relação ao vProd
4. **DIFAL não calculado**: Para operações com não-contribuinte, DIFAL não é computado
5. **Sem histórico de alterações**: Mudanças nas regras não são versionadas
6. **Fundos fixos em 0,4%**: O percentual de fundos é fixo, não varia por cenário (exceto onde é 0)
7. **Aplicação (revenda/industrialização) não detectada automaticamente**: No auditor, aplicação é null — ramificações que exigem aplicação específica não casam
8. **Sem validação de prazos**: Não verifica se a NF-e está dentro do período de vigência do TTD
9. **Carga efetiva assumida constante**: Não varia por faixa de BC ou período
10. **Sem reconciliação com SPED/EFD**: Os totais calculados não são confrontados com escrituração fiscal
