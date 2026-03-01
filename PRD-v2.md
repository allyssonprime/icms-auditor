# PRD — Auditor Fiscal de NF-e de Saída (TTD 410/SC)

**Projeto:** Prime NF-e Auditor
**Versão:** 2.0
**Data:** 01/03/2026
**Owner:** Maicon — Prime Internacional

**Fontes validadas:**
- Termo de Concessão TTD 410 (nº 245000003024507)
- Quadro Resumo TTD 409/410/411 (Almir Gorges)
- Checklist de Importação para Comercialização (Almir Gorges, 2022)
- RICMS/SC Anexo 2, Art. 246 + Lei 17.763/2019

---

## 1. Problema

A Prime emite 100-500 NF-e de saída/mês com regras tributárias complexas do TTD 410/SC. A combinação de variáveis (tipo de destinatário, NCM, Lista CAMEX, Decreto 2.128, CST, CFOP, alíquota interestadual vs interna, redução de BC, ST) cria uma **matriz de decisão com ~25 cenários distintos**. Erros na emissão geram risco de autuação, perda do benefício fiscal ou prejuízo comercial.

Hoje a conferência é manual/visual. A versão anterior do projeto fracassou por tentar resolver tudo como um bloco monolítico de regras.

---

## 2. Solução

App web (React) que recebe XMLs de NF-e via drag-and-drop, extrai os dados fiscais de cada item e valida contra uma **árvore de decisão modular** baseada no TTD 410. Resultado: semáforo por NF + detalhamento item a item + relatório exportável.

**Analogia:** É um "linter fiscal" — assim como um linter de código verifica regras de sintaxe linha a linha, o auditor verifica regras tributárias item a item.

---

## 3. Princípios de Design

1. **Modular, não monolítico** — cada regra é um módulo independente que retorna OK/ERRO/ALERTA
2. **Árvore de decisão, não tabela de regras** — a validação segue um fluxo hierárquico (primeiro filtrar vedações, depois determinar cenário, depois validar alíquota)
3. **Falhar ruidosamente** — quando o sistema não consegue classificar um cenário, deve alertar (amarelo), nunca assumir OK
4. **Dados de referência editáveis** — listas (Decreto 2.128, CAMEX, Redução BC) são tabelas configuráveis, não hardcoded
5. **Cenários com alternativas** — quando existem opções facultativas (ex: CAMEX 2,1% vs 3,6%), o sistema deve reconhecer ambas como válidas

---

## 4. Árvore de Decisão — Lógica Central

A validação de cada **item** da NF-e segue esta hierarquia:

```
ITEM DA NF-e
│
├─ ETAPA 1: VEDAÇÕES (bloqueante)
│  ├─ NCM está no Decreto 2.128? → ERRO: "TTD vedado para esta NCM"
│  ├─ Mercadoria usada (CFOP indica)? → ERRO: "TTD vedado para usados"
│  ├─ Produto industrializado pela Prime (CST + NCM mudou)? → ERRO: "CP não se aplica"
│  └─ Dívida ativa? (flag manual) → ERRO: "CP vedado"
│
├─ ETAPA 2: CLASSIFICAÇÃO DO CENÁRIO
│  ├─ Operação Interestadual ou Interna? (UF destinatário)
│  ├─ Destinatário: Contribuinte Normal / Simples Nacional / PJ Não Contrib. / Pessoa Física?
│  ├─ NCM na Lista CAMEX (sem similar)? → altera alíquota esperada
│  ├─ NCM é Cobre ou Aço? → carga efetiva 0,6%
│  ├─ Mercadoria tem Redução de BC na legislação? → cenário especial
│  ├─ Mercadoria sujeita a ST? → afeta tratamento para SN
│  ├─ Destinatário é Industrial (MP com mudança NCM)? → opção 10%
│  ├─ Destinatário é CD exclusivo? → cenário B11
│  ├─ Destinatário tem TTD com diferimento (Pró-Emprego)? → vedação 2.5.a
│  └─ Destinatário é indústria têxtil/confecções (art.15 XXXIX)? → vedação 2.5.b
│
├─ ETAPA 3: VALIDAÇÃO DA ALÍQUOTA
│  ├─ Comparar alíquota destacada na NF vs alíquota(s) esperada(s) do cenário
│  │  (cenários com alternativas aceitam mais de uma alíquota como válida)
│  ├─ Comparar CST destacado vs CST esperado
│  └─ Comparar CFOP destacado vs CFOP esperado
│
├─ ETAPA 4: VALIDAÇÃO DA BASE DE CÁLCULO
│  ├─ BC deve ser integral (sem redução) para cálculo dos Fundos (item 1.5)
│  ├─ Para conta e ordem: BC especial (item 1.15)
│  └─ Verificar consistência: BC × alíquota = valor ICMS destacado
│
└─ ETAPA 5: ALERTAS INFORMATIVOS
   ├─ Comunicação obrigatória ao destinatário (Anexos 1, 2, 3)
   ├─ Estorno/complemento pelo destinatário
   ├─ Lembrete de Fundos 0,4%
   ├─ "Diferimento parcial do imposto" nas inf. complementares
   └─ Sugestões comerciais (ex: optar por 10% para industrial)
```

---

## 5. Cenários de Saída — Matriz Completa Validada

### 5.1 Saídas Interestaduais

| # | Cenário | CAMEX? | Alíq. NF | Efetiva (ICMS) | +Fundos | CST | Ref. TTD |
|---|---------|--------|----------|----------------|---------|-----|----------|
| A1 | Contribuinte (Normal ou SN) | Não | 4% | 1,0% | +0,4% = **1,4%** | 090 | 1.2.a.2 |
| A2 | Contribuinte | Sim | 12% ou 7%¹ | 3,6% | +0,4% = **4,0%** | 090 | 1.2.b.2 |
| A3 | Contribuinte (opção facultativa) | Sim | 12% ou 7%¹ | 2,1% | +0,4% = **2,5%** | 090 | 1.2.c |
| A4 | PJ Não Contribuinte | Não | 4% + DIFA | 1,0% | +0,4% = **1,4%** | 090 | 1.2.a + 1.25 |
| A5 | PJ Não Contribuinte | Sim | 12% ou 7%¹ + DIFA | 3,6% | +0,4% = **4,0%** | 090 | 1.2.b.3 |
| A6 | Pessoa Física outra UF | Não | 4% + DIFA | 1,0% | +0,4% = **1,4%** | 090 | 1.2.a + 1.25 |
| A7 | Pessoa Física outra UF | Sim | 12% ou 7%¹ + DIFA | 3,6% | +0,4% = **4,0%** | 090 | 1.2.b.3 |
| A8 | Cobre/Aço — contribuinte | Não | 4% | 0,6% | +0,4% = **1,0%** | 090 | 1.2.a.1 |
| A9 | Transferência interestadual (filial) | N/A | 4% ou 12%/7% | Com CP | +0,4% | 090 | 1.6 |

¹ 7% para destino N, NE, CO e ES (Res. SF 22/89). 12% para S e SE.

**Notas interestaduais:**
- DIFA de não contribuinte: todo cabe à UF de destino (atualmente). Item 1.25 do TTD permite CP adicional sobre parcela DIFA devida a SC (hoje = zero).
- A opção A3 (2,1%) é facultativa e só vale para destinatário contribuinte.
- Checklist 03.3: para PF em outra UF, CP se aplica normalmente (diferente da regra interna).

---

### 5.2 Saídas Internas (dentro de SC)

| # | Cenário | CAMEX? | Alíq. NF | Efetiva (ICMS) | +Fundos | CST | Ref. TTD |
|---|---------|--------|----------|----------------|---------|-----|----------|
| **Contribuinte Normal** | | | | | | | |
| B1 | Contribuinte Normal — regra geral | Não | 4% | 1,0% | +0,4% = **1,4%** | 051 | 1.2.a + 1.13.c |
| B2 | Contribuinte Normal — CAMEX (padrão) | Sim | 12% | 3,6% | +0,4% = **4,0%** | 051 | 1.2.b.2 + 1.13.a |
| B2-ALT | Contribuinte Normal — CAMEX (opção 2,1%) | Sim | 12% | 2,1% | +0,4% = **2,5%** | 051² | 1.2.d |
| **Industrial** | | | | | | | |
| B3 | Industrial (MP c/ mudança NCM) — opção | Não | 10% | 3,6% | +0,4% = **4,0%** | 051 | 1.2.e + 1.13.b |
| B3-CAMEX | Industrial — CAMEX (MP c/ mudança NCM) | Sim | 10%³ | 3,6% | +0,4% = **4,0%** | 051 | 1.2.e + 1.13.b |
| **Simples Nacional** | | | | | | | |
| B4 | SN + mercadoria COM ST | Não | 4% | 1,0% | +0,4% = **1,4%** | 010/070 | 1.2.a + 1.14.a (exceção) |
| B4-CAMEX | SN + mercadoria COM ST + CAMEX | Sim | 12% | 3,6% | +0,4% = **4,0%** | 010/070 | 1.2.b.2 |
| B5 | SN + mercadoria SEM ST | Não | Alíq. interna⁴ | 3,6% | +0,4% = **4,0%** | 000 | 1.2.b.1 + 1.14.a |
| B5-CAMEX | SN + SEM ST + CAMEX | Sim | Alíq. interna⁴ | 3,6% | +0,4% = **4,0%** | 000 | 1.2.b.1 |
| **PJ Não Contribuinte** | | | | | | | |
| B6 | PJ Não Contribuinte | Não | Alíq. interna⁴ | 3,6% | +0,4% = **4,0%** | 000 | 1.2.b.1 + 1.14.b |
| B6-CAMEX | PJ Não Contribuinte + CAMEX | Sim | Alíq. interna⁴ | 3,6% | +0,4% = **4,0%** | 000 | 1.2.b.1 |
| **Pessoa Física** | | | | | | | |
| B7 | Pessoa Física (consumidor final) | N/A | Alíq. interna⁴ | **Integral (SEM CP)** | N/A | 000 | 2.1.c.3 + 1.14.b |
| **Ativo / Uso / Consumo** | | | | | | | |
| B8 | Contribuinte — ativo/uso/consumo | Não | 4% | 1,0% | +0,4% = **1,4%** | 051 | 1.13.c + 1.14.e (exceção) |
| **Redução de Base de Cálculo** | | | | | | | |
| B-RBC | Mercadoria com redução de BC | Ambos | Menor⁵ | 4,0% | +0,4% | 051 | 1.7 + 1.14.c |
| **Vedações Especiais (item 2.5)** | | | | | | | |
| B9 | Dest. com TTD / diferimento (Pró-Emprego) | N/A | Diferido | Sem CP | N/A | 051 | 1.14.d + 2.5.a |
| B10 | Dest. têxtil/confecções (art.15 XXXIX) | Não | 10% | 3,6% | +0,4% = **4,0%** | 051 | 2.5.b |
| **Centro de Distribuição** | | | | | | | |
| B11 | CD Exclusivo (Booster) | N/A | 10% | 1,0% | +0,4% = **1,4%** | 051 | 1.26 |
| **Transferências** | | | | | | | |
| B12 | Transferência interna (filial SC) | N/A | Diferido | **Sem CP** | N/A | 051 | 2.1.c.2 |

² CST com origem 6 (Tabela A) quando opção 2,1% — conforme Anexo 2 do TC.
³ Verificar: para industrial CAMEX, pode ser que se aplique 12% em vez de 10%. Confirmar com área fiscal.
⁴ Alíquota interna conforme produto: 25%, 17%, 12%, 8,80%, 7% etc. Desde março/2020, muitas mercadorias passaram a 12% (RICMS-SC, Art.26, III, n).
⁵ Destaque = o menor entre o diferimento parcial e a carga tributária com redução de BC. Ex: se redução BC resulta em 8,80%, destaca 8,80% (não 10% nem 4%). ICMS efetivo permanece no piso do TTD. Ref: item 1.7.

---

### 5.3 Notas Gerais

**Fundos (piso 0,4% sobre BC integral):**
- A partir de abril/2022 (Portaria SEF 143/2022): FUNDO SOCIAL (2,5% da exoneração) + FUMDES (2% da exoneração). Se soma < 0,4% da BC integral, complementar até 0,4%.
- Adicionalmente: FIA (1% IRPJ) + FEI-SC (1% IRPJ) — somente Lucro Real.
- Para v1 do auditor: usar 0,4% sobre BC integral como cálculo simplificado.

**Cobre e Aço (NCMs específicas):**
- Carga efetiva = 0,6% (não 1,0%) no cenário A1/B1 equivalente.
- NCMs: capítulos 72-73 (aço) e 74 (cobre), mais prata 7106.

**Comunicações obrigatórias ao destinatário:**
| Quando | Comunicação | Ref. TC |
|--------|-------------|---------|
| Saída interna 10% (industrial ou CD) | Anexo 1 — Obrigação de Estorno | 1.19.c.1 |
| Saída interna 12% CAMEX com opção 2,1% | Anexo 2 — Obrigação de Complemento 1,5% | 1.19.c.2 |
| Saída para CD exclusivo | Anexo 3 — Estorno + Comunicação anual | 1.19.c.3 |

**Devoluções:**
- Estornar CP apropriado (item 1.20).
- Fundos recolhidos: creditar como ICMS via DCIP código 54 / DIME Quadro 46 (itens 8.8 e 8.9).
- A partir de abril/2022: crédito de Fundos só compensa com Fundos a recolher nos meses seguintes (RICMS-SC, Art.103-C).

---

## 6. Dados Extraídos do XML da NF-e

### 6.1 Dados por Item (`<det>`)

| Campo | XPath no XML | Uso |
|-------|-------------|-----|
| NCM | `det/prod/NCM` | Verificar Decreto 2.128, Lista CAMEX, Cobre/Aço, Redução BC |
| CFOP | `det/prod/CFOP` | Tipo operação (interna/interestadual/transferência/devolução) |
| CST ICMS | `det/imposto/ICMS/*/orig` + `CST` | Validar CST vs cenário |
| Alíquota ICMS | `det/imposto/ICMS/*/pICMS` | Comparar com alíquota esperada |
| Base Cálculo ICMS | `det/imposto/ICMS/*/vBC` | Validar BC integral |
| Valor ICMS | `det/imposto/ICMS/*/vICMS` | Conferir cálculo (BC × alíquota) |
| Valor do Produto | `det/prod/vProd` | Referência para BC |
| ICMS-ST (se houver) | `det/imposto/ICMS/*/vBCST`, `vICMSST` | Identificar operação com ST |

### 6.2 Dados do Destinatário (`<dest>`)

| Campo | XPath | Uso |
|-------|-------|-----|
| UF Destinatário | `dest/enderDest/UF` | Interestadual vs Interna + região (7% ou 12%) |
| IE Destinatário | `dest/IE` | Contribuinte vs Não contribuinte |
| Ind IE Dest | `dest/indIEDest` | 1=Contribuinte, 2=Isento, 9=Não contribuinte |
| CNPJ/CPF Dest | `dest/CNPJ` ou `dest/CPF` | PJ vs PF |

### 6.3 Dados do Cabeçalho (`<ide>` e `<infAdic>`)

| Campo | XPath | Uso |
|-------|-------|-----|
| Natureza da Operação | `ide/natOp` | Contexto |
| Tipo NF | `ide/tpNF` | Confirmar saída (1) |
| Inf. Complementares | `infAdic/infCpl` | Verificar "Diferimento parcial do imposto" e "ICMS diferido" |

### 6.4 Mapa de UFs para alíquota CAMEX interestadual

| Alíquota | UFs de destino |
|----------|---------------|
| 7% | AC, AL, AM, AP, BA, CE, DF, ES, GO, MA, MG⁶, MS, MT, PA, PB, PE, PI, RN, RO, RR, SE, TO |
| 12% | PR, RJ, RS, SP |

⁶ MG: verificar — algumas fontes colocam MG na faixa de 7%, outras em 12%. [Confirmar]

---

## 7. Tabelas de Referência (editáveis pelo usuário)

### 7.1 Lista Decreto 2.128/2009 (NCMs vedadas)

NCMs onde o TTD **não pode** ser aplicado. Lista completa conforme Anexo Único atualizado:

| Item | NCM | Mercadoria | Vedação absoluta? |
|------|-----|-----------|-------------------|
| 1 | 7005 | Vidros float e reflexivos | Não (exceto itens 8-18) |
| 2 | 7007 | Vidros de segurança | Não |
| 3 | 7009 | Espelhos | Não |
| 4 | 9607 | Fechos ecler (exceto insumos p/ fabricação) | Não |
| 5 | 8903 | Iates/embarcações até 60 pés | Não |
| 6 | 6911.10.10/90 | Porcelanas de mesa | Não |
| 7 | 7013 | Cálices de vidro/cristal | Não |
| 8 | 2207.10 | Álcool etílico anidro/hidratado | **SIM** |
| 9 | 2710.12.5 | Gasolinas | **SIM** |
| 10 | 2710.19.1 | Querosenes | **SIM** |
| 11 | 2710.19.2 | Óleos combustíveis | **SIM** |
| 12 | 2710.19.3 | Óleos lubrificantes | **SIM** |
| 13 | 2710.19.9 | Outros óleos de petróleo (com exceções) | **SIM** |
| 14 | 2710.9 | Resíduos de óleos | **SIM** |
| 15 | 2711 | Gás de petróleo/hidrocarbonetos gasosos | **SIM** |
| 17 | 3826.00.00 | Biodiesel e misturas | **SIM** |
| 18 | 3403 | Preparações lubrificantes | **SIM** |
| 19 | 2710.12.30 | Aguarrás mineral | Verificar |
| 20 | 1604... | Conservas sardinha/atum/bonito | Não (exceto p/ industrial c/ RE) |
| 21 | 5402.44.00 | Fios de filamentos sintéticos elastômeros | Não |
| 22 | 5404.11.00 | Monofilamentos sintéticos elastômeros | Não |
| 23 | 8451.50.20 | Máquinas de corte automático de tecidos | Não |
| 47 | 2710.12.4 | Nafta petroquímica | Verificar |
| 48 | 7307.19.10 | Tubos de ferro fundido maleável | Verificar |
| 49 | 7307.19.90 | Conexões de ferro fundido maleável | Verificar |

**Exceções (art. 2º):** Itens 1-7 e 19-23 podem usar TTD se comprovada ausência de produção em SC (laudo técnico). Itens 8-18: vedação absoluta (§5º).

### 7.2 Lista CAMEX (sem similar nacional)

NCMs constantes da Resolução GECEX vigente com II = 0% ou 2%. Usam alíquota 12% (ou 7%) interestadual, não 4%.

O usuário mantém esta lista atualizada manualmente. Formato:
```json
[{"ncm": "XXXX.XX.XX", "descricao": "...", "aliquota_interestadual": "12% ou 7%"}]
```

### 7.3 Lista Cobre e Aço

NCMs com carga efetiva de 0,6% (não 1,0%):
- Capítulo 72: Ferro fundido, ferro e aço (7201 a 7229)
- Capítulo 73: Obras de ferro fundido, ferro ou aço (7301 a 7326)
- Capítulo 74: Cobre e suas obras (7401 a 7419)
- 7106: Prata

### 7.4 Lista de Destinatários Especiais (input manual)

| Tipo | Uso | Cenário |
|------|-----|---------|
| CNPJs no Simples Nacional | Classificar destinatário SN | B4/B5 |
| CNPJs com TTD (Pró-Emprego) | Vedação 2.5.a | B9 |
| CNPJs têxtil/confecções (art.15 XXXIX) | Vedação 2.5.b | B10 |
| CNPJs industriais (MP c/ mudança NCM) | Opção 10% | B3 |
| CNPJs CD exclusivo | Cenário especial | B11 |

### 7.5 Tabela de Alíquotas Internas SC

Para cenários que exigem "alíquota interna" (B5, B6, B7), o auditor precisa saber qual alíquota aplicar por NCM:
- 25%: supérfluos (perfumaria, cosméticos, bebidas alcoólicas etc.)
- 17%: regra geral
- 12%: alimentos, medicamentos, máquinas (desde março/2020, RICMS-SC Art.26, III, n)
- 8,80%: mercadorias com redução de BC específica
- 7%: casos específicos

**Para v1:** aceitar qualquer alíquota interna válida (7%, 8,80%, 12%, 17%, 25%) nos cenários que exigem alíquota integral.
**Para v2:** tabela NCM → alíquota interna SC para validação exata.

---

## 8. Interface — Wireframe Funcional

### 8.1 Tela Principal

```
┌─────────────────────────────────────────────────────────┐
│  PRIME NF-e AUDITOR v2                    [Configurar]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────┐                   │
│  │  Arraste XMLs aqui               │                   │
│  │  ou clique para selecionar       │                   │
│  │  (aceita múltiplos arquivos)     │                   │
│  └──────────────────────────────────┘                   │
│                                                          │
│  ── RESUMO ─────────────────────────────────────────── │
│                                                          │
│  🟢 42 NF-e OK    🟡 8 Alertas    🔴 3 Erros           │
│                                                          │
│  Total BC: R$ 1.234.567,89                              │
│  Fundos estimados (0,4%): R$ 4.938,27                   │
│                                                          │
│  [Exportar Excel] [Exportar PDF] [Gerar Planilha 7.7]  │
│                                                          │
│  ── DETALHAMENTO ───────────────────────────────────── │
│                                                          │
│  🔴 NF 000.123.456 — Dest: ACME Ltda (PR)              │
│  ├─ Item 1: NCM 7007.19.00 — ERRO                      │
│  │  Regra V01: "NCM vedada (Decreto 2.128, item 2).    │
│  │  TTD não pode ser aplicado."                         │
│  ├─ Item 2: NCM 8471.30.19 — OK (Cenário A1)           │
│  │  Alíquota 4% ✓ | CST 090 ✓ | BC integral ✓          │
│  └─ Item 3: NCM 8517.62.39 — OK (Cenário A1)           │
│                                                          │
│  🟡 NF 000.123.789 — Dest: XYZ Indústria (SC)          │
│  ├─ Item 1: NCM 8471.30.19 — ALERTA (Cenário B1)       │
│  │  I05: "Destinatário é industrial — considerar        │
│  │  opção 10% (mais crédito para o cliente)."           │
│  │  I07: "Verificar 'Diferimento parcial' nas           │
│  │  informações complementares."                        │
│  └─ Item 2: NCM 8517.62.39 — OK (Cenário B1)           │
│                                                          │
│  🟡 NF 000.124.001 — Dest: ABC Com. (SC) [SIMPLES]     │
│  └─ Item 1: NCM 8471.30.19 — ALERTA (Cenário B5)       │
│     "Dest. é Simples Nacional, mercadoria sem ST.       │
│      Destaque deve ser alíquota interna (12%/17%).      │
│      Alíquota encontrada: 4% → POSSÍVEL ERRO"          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Tela de Configuração

- Editar lista Decreto 2.128 (adicionar/remover NCMs)
- Editar lista CAMEX (adicionar/remover NCMs)
- Editar lista Cobre/Aço
- Editar listas de destinatários especiais (SN, TTD, têxtil, industriais, CD)
- Visualizar árvore de decisão ativa
- Versão das listas + data última atualização

### 8.3 Relatórios Exportáveis

**Excel com abas:**
- "Resumo": semáforo por NF (quantidade OK/alerta/erro)
- "Detalhamento": item a item, cenário aplicado, regra disparada
- "Regras": qual regra validou/falhou em cada item
- "Fundos": BC integral por NF para cálculo dos Fundos

**PDF:** Versão consolidada do relatório para arquivo.

### 8.4 Planilha Mensal Obrigatória (item 7.7/7.8 do TTD) — v1.0

Output adicional que gera automaticamente a planilha de controle exigida pela SEFAZ/SC:
- Correlação NF saída × percentual de tributação efetiva
- Cálculo do CP apropriado (separado por cenário/alíquota)
- Cálculo dos Fundos (2,5% FUNDO SOCIAL + 2% FUMDES + complemento até 0,4%)
- Devoluções e estornos de CP
- Formato pronto para fiscalização

---

## 9. Regras de Validação — Módulos

### Módulo 1: Vedações (BLOQUEANTE)

| ID | Regra | Condição | Resultado |
|----|-------|----------|-----------|
| V01 | Decreto 2.128 | NCM do item ∈ lista_decreto_2128 | 🔴 ERRO |
| V02 | Mercadoria usada | CFOP indica operação com usado | 🔴 ERRO |
| V03 | Industrializado | CST indica industrialização + NCM diferente do importado | 🔴 ERRO |
| V04 | Dívida ativa | Flag manual ativado | 🔴 ERRO |

### Módulo 2: Classificação de Cenário

| ID | Regra | Lógica |
|----|-------|--------|
| C01 | Tipo operação | UF dest ≠ "SC" → interestadual; UF dest = "SC" → interna |
| C02 | Tipo destinatário | indIEDest=1 + CNPJ → contribuinte; indIEDest=9 + CNPJ → PJ não contrib.; CPF → PF |
| C03 | Simples Nacional | CNPJ ∈ lista_simples → SN |
| C04 | Similar nacional | NCM ∈ lista_camex → sem similar (CAMEX) |
| C05 | Cobre/Aço | NCM ∈ lista_cobre_aco → carga 0,6% |
| C06 | ST | CST contém 010, 030, 060 ou 070 → com ST |
| C07 | Transferência | CFOP 5152/5155/6152/6155 → transferência |
| C08 | Devolução | CFOP 5201/5202/6201/6202 → devolução (tratamento especial) |
| C09 | Industrial | CNPJ ∈ lista_industriais → opção 10% disponível |
| C10 | CD exclusivo | CNPJ ∈ lista_cd → cenário B11 |
| C11 | Vedação 2.5.a | CNPJ ∈ lista_ttd_diferimento → vedação |
| C12 | Vedação 2.5.b | CNPJ ∈ lista_textil_art15 → vedação, obrigatório 10% |
| C13 | Redução BC | NCM ∈ lista_reducao_bc → cenário especial |
| C14 | Região destino | UF dest → grupo (7% ou 12%) para CAMEX interestadual |

### Módulo 3: Validação de Alíquota

| ID | Cenário | Alíquota(s) Aceita(s) | Se diverge |
|----|---------|----------------------|------------|
| AL01 | A1 — Interestadual contribuinte | 4% | 🔴 ERRO |
| AL02 | A2 — Interestadual contrib. CAMEX | 12% ou 7% (conforme UF) | 🔴 ERRO |
| AL03 | A3 — Interestadual contrib. CAMEX opção | 12% ou 7% | 🟡 ALERTA (verificar se opção 2,1%) |
| AL04 | B1 — Interna contribuinte normal | 4% | 🔴 ERRO |
| AL05 | B2 — Interna contribuinte CAMEX | 12% | 🔴 ERRO |
| AL06 | B3 — Interna industrial 10% | 10% ou 4% | 🟡 ALERTA (4% é válido mas 10% é opção) |
| AL07 | B4 — SN COM ST | 4% | 🔴 ERRO |
| AL08 | B4-CAMEX — SN COM ST CAMEX | 12% | 🔴 ERRO |
| AL09 | B5 — SN SEM ST | Alíq. interna (12%, 17%, 25%) | 🔴 ERRO |
| AL10 | B6 — PJ Não Contribuinte | Alíq. interna (12%, 17%, 25%) | 🔴 ERRO |
| AL11 | B7 — Pessoa Física | Alíq. interna (12%, 17%, 25%) | 🔴 ERRO |
| AL12 | B8 — Ativo/uso/consumo | 4% | 🔴 ERRO |
| AL13 | B-RBC — Redução de BC | Conforme tabela redução | 🟡 ALERTA |
| AL14 | B10 — Dest. têxtil (vedação 2.5.b) | 10% | 🔴 ERRO (se 4%) |
| AL15 | B11 — CD exclusivo | 10% | 🔴 ERRO |
| AL16 | A8 — Cobre/Aço interestadual | 4% | 🔴 ERRO |

### Módulo 4: Validação de CST

| ID | Cenário | CST Esperado (orig + trib) | Obs |
|----|---------|---------------------------|-----|
| CST01 | Saída interna COM diferimento parcial | X51 | X = origem (0-8) |
| CST02 | Saída interestadual | X90 | "Outras" |
| CST03 | Saída interna SEM diferimento (SN s/ ST, PJ NC, PF) | X00 | Tributação integral |
| CST04 | Saída com ST | X10 ou X70 | ST |
| CST05 | Opção 2,1% CAMEX (CST com origem 6) | 6XX | Verificar Tab. A Convênio s/nº |

### Módulo 5: Validação de CFOP

| ID | Cenário | CFOPs Aceitos |
|----|---------|---------------|
| CF01 | Venda interestadual | 6101, 6102, 6106, 6107 |
| CF02 | Venda interna | 5101, 5102, 5106, 5107 |
| CF03 | Transferência interestadual | 6152, 6155 |
| CF04 | Transferência interna | 5152, 5155 |
| CF05 | Conta e ordem | 5949, 6949 (ou específicos conforme operação) |
| CF06 | Devolução recebida | 1201, 1202, 2201, 2202 |
| CF07 | Venda para não contribuinte interestadual | 6107, 6108 |

### Módulo 6: Alertas Informativos

| ID | Regra | Quando dispara | Resultado |
|----|-------|----------------|-----------|
| I01 | Comunicação Anexo 1 | Cenário B3/B11 (saída 10%) | 🟡 "Enviar comunicação de estorno ao destinatário" |
| I02 | Comunicação Anexo 2 | Cenário B2-ALT (opção 2,1% CAMEX) | 🟡 "Enviar comunicação de complemento 1,5%" |
| I03 | Comunicação Anexo 3 | Cenário B11 (CD) | 🟡 "Enviar comunicação ao CD (estorno + declaração anual)" |
| I04 | Complemento 1,5% | Cenário B2-ALT | 🟡 "Destinatário deve complementar 1,5% (DARE 1554)" |
| I05 | Sugestão comercial | Interna p/ industrial com 4% | 🟡 "Considerar opção 10% — mais crédito para o cliente" |
| I06 | Fundos | Toda NF com TTD | ℹ️ "Lembrete: Fundos 0,4% sobre BC integral (Portaria SEF 143/2022)" |
| I07 | Inf. complementar | Interna com diferimento parcial | 🟡 "Verificar se consta 'Diferimento parcial do imposto'" |
| I08 | Conta e ordem | CFOP indica conta e ordem | 🟡 "BC especial (item 1.15). Verificar manualmente." |
| I09 | Devolução | CFOP de devolução | 🟡 "Estornar CP apropriado (item 1.20). Fundos: creditar via DCIP 54." |
| I10 | Cobre/Aço | NCM cobre/aço detectada | ℹ️ "Carga efetiva 0,6% (não 1,0%). Verificar." |
| I11 | Alíquota interna 12% | NCM pode ter alíquota 12% desde mar/2020 | 🟡 "Verificar se alíquota interna é 12% (Art.26, III, n)" |

---

## 10. Limitações Conhecidas (v1)

| # | Limitação | Workaround v1 | Solução futura |
|---|-----------|---------------|----------------|
| 1 | Simples Nacional — XML não informa | Lista manual de CNPJs | API consulta CNPJ |
| 2 | Destinatário com TTD — XML não informa | Lista manual de CNPJs | Integração SEFAZ |
| 3 | Industrial vs Comercial — XML não diferencia | Lista manual ou inferir CNAE | API CNPJ/CNAE |
| 4 | Lista CAMEX — muda periodicamente | Usuário mantém manualmente | Scraping Resolução GECEX |
| 5 | Conta e Ordem — BC diferente | Alerta para verificação manual | Cálculo automático (v2) |
| 6 | Redução de BC — NCMs variam | Alerta genérico | Tabela NCM × redução BC |
| 7 | Alíquota interna por NCM | Aceitar qualquer interna válida | Tabela NCM → alíquota SC |
| 8 | Novos Fundos (Portaria 143/2022) | Cálculo simplificado 0,4% | Cálculo real (exoneração) |

---

## 11. Stack Técnica

- **Frontend:** React (SPA) — roda 100% no browser, sem backend
- **Parser XML:** DOMParser nativo do browser
- **Lógica:** TypeScript com módulos de validação isolados
- **Armazenamento:** localStorage para listas de referência e configurações
- **Export Excel:** SheetJS (xlsx)
- **Export PDF:** jsPDF ou html2pdf
- **Deploy:** Estático (pode hospedar em qualquer lugar)

**Por que client-side only?** Os XMLs contêm dados fiscais sensíveis. Processar tudo no browser elimina risco de vazamento via servidor.

---

## 12. Fases de Entrega

| Fase | Escopo | Cenários | Prioridade |
|------|--------|----------|------------|
| **v0.1 — MVP** | Upload XML + parse + vedações (Decreto 2.128) + cenários interestaduais básicos (A1, A2, A8) | 3 | 🔴 Alta |
| **v0.2** | Cenários internos básicos (B1, B4, B5, B6, B7) + CST + CFOP | 5 | 🔴 Alta |
| **v0.3** | Semáforo dashboard + relatório Excel exportável | — | 🔴 Alta |
| **v0.4** | Cenários CAMEX completos (A2/A3/A5/A7, B2/B2-ALT/B4-CAMEX) + 7% vs 12% | 7 | 🟡 Média |
| **v0.5** | Industrial (B3), CD (B11), vedações 2.5 (B9/B10), cobre/aço | 5 | 🟡 Média |
| **v0.6** | Alertas informativos (comunicações, devoluções) | — | 🟡 Média |
| **v0.7** | Redução de BC (B-RBC) + conta e ordem (alertas) | 2 | 🟢 Baixa |
| **v1.0** | Listas editáveis na UI + PDF export + Planilha 7.7/7.8 + batch | — | 🟢 Baixa |

---

## 13. Métricas de Sucesso

- **Cobertura:** % de NF-e que o sistema consegue classificar sem "cenário desconhecido" (meta: >90%)
- **Precisão:** % de erros detectados que são erros reais — zero falso positivo (meta: >95%)
- **Tempo:** < 5 segundos para processar 50 XMLs
- **Adoção:** Equipe fiscal usando semanalmente dentro de 30 dias

---

## 14. Glossário

| Termo | Significado |
|-------|------------|
| TTD 410 | Tratamento Tributário Diferenciado nº 410 — benefício fiscal de SC para importadores (dispensa antecipação e garantia) |
| CP | Crédito Presumido — reduz a carga tributária efetiva na saída |
| BC | Base de Cálculo |
| CST | Código de Situação Tributária — indica o tratamento tributário do ICMS |
| CFOP | Código Fiscal de Operações e Prestações — indica a natureza da operação |
| Lista CAMEX | Produtos sem similar nacional (Res. GECEX) — usam 12%/7% interestadual |
| Decreto 2.128 | Lista de mercadorias excluídas do TTD — vedação |
| Fundos | Contribuições obrigatórias para manutenção do TTD (piso 0,4% sobre BC) |
| TC | Termo de Concessão (documento oficial SEFAZ/SC) |
| Diferimento parcial | ICMS parcialmente postergado — alíquota efetiva menor na NF |
| SN | Simples Nacional |
| ST | Substituição Tributária |
| DIFA | Diferencial de Alíquota |
| CD | Centro de Distribuição Exclusivo |
| Exoneração tributária | Diferença entre imposto sem TTD e com TTD (base para cálculo dos novos Fundos) |
