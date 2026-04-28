# CLAUDE.md

Este arquivo fornece orientações para o Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## Projeto

**ICMS Auditor** — auditor fiscal no navegador para XMLs de NF-e (Nota Fiscal Eletrônica), especializado no regime **TTD 410** de Santa Catarina. Classifica cada item da nota em um de ~22 cenários tributários (A1–A9 interestaduais, B1–B12 internos), valida alíquota / CST / CFOP / base de cálculo / crédito presumido, calcula o ICMS a recolher mais as contribuições aos fundos estaduais e faz reconciliação com arquivos da EFD.

O auditor é um "linter fiscal": cada regra é um módulo pequeno que retorna `OK / INFO / AVISO / DIVERGENCIA / ERRO`. A especificação de referência — cenários, vedações e IDs das regras — está em [PRD-v2.md](PRD-v2.md) e o panorama consolidado em [RESUMO-COMPLETO-REGRAS-NEGOCIO.md](RESUMO-COMPLETO-REGRAS-NEGOCIO.md). Trate esses documentos como o contrato; mudanças no engine que divergirem deles devem ser sinalizadas explicitamente.

## Comandos

```bash
npm run dev            # Servidor dev do Vite
npm run build          # tsc -b (strict) seguido de vite build — PRECISA passar antes de declarar "pronto"
npm run lint           # eslint .
npm run test           # vitest run (jsdom, src/**/*.test.ts{,x})
npm run test:watch     # vitest (watch)
npm run test:scripts   # vitest run --config vitest.scripts.config.ts (env node, scripts/**/*.test.ts)
```

Rodar um único arquivo de teste ou padrão: `npx vitest run src/engine/__tests__/validator.test.ts` ou `npx vitest run -t "A2 CAMEX"`.

Os scripts Node em [scripts/](scripts/) são **ferramentas de auditoria de uso apenas em testes** (executados com `test:scripts`), não fazem parte do bundle da aplicação; mantenha-os fora do `include` padrão do `vitest.config.ts`.

## Stack

React 19 + TypeScript 5.9 + Vite 7 + Tailwind v4 (via `@tailwindcss/vite`) + shadcn/ui (primitivos Radix) + Firebase 12 (Firestore) + Vitest 4 / jsdom. Alias de path `@/* → ./src/*` (tsconfig + vite). Ícones Lucide. Exportação Excel via `exceljs`; ingestão de XMLs zipados via `fflate`; download de arquivos via `file-saver`.

## Arquitetura — Visão Geral

O pipeline é estritamente linear e cada estágio é testável isoladamente:

```
XML/ZIP/EFD → DropZone → parseNfe / parseEfd
                           ↓
                        NfeData[] / EfdData
                           ↓
                        nfeFilters (cancelada, estornos, allowlist de CFOP/valor)
                           ↓
                        validarNfe()  ──────────────────────────────────┐
                           │                                             │
                           ├─ verificarVedacoes  (bloqueante)            │
                           ├─ computarCamposDerivados (8 flags)          │
                           ├─ classificarCenario → cenarioId             │
                           ├─ validarAliquota / CST / CFOP / BC / CP /   │
                           │  infCpl  → ValidationResult[]               │
                           ↓                                             │
                        NfeValidation                                    │
                           ├─ Dashboard / tabelas de auditoria / Export  │
                           ├─ ReconciliacaoPanel / ApuracaoTTDPage       │
                           └─ crossValidate(NFs, EFD) ───────────────────┘
```

Regras estruturais essenciais:

- **Regras de cenário são dados, não código.** Os 22 cenários estão expressos como entradas `GrupoRegra` em [src/data/defaultRegras.ts](src/data/defaultRegras.ts). [src/engine/cenarios.ts](src/engine/cenarios.ts) expande isso em tempo de execução para um `Record<cenarioId, CenarioConfig>` plano via `getCenarios(regras)`. Adicionar ou alterar um cenário significa editar os dados da regra e adicionar testes — e não criar desvios no validator. O helper `mergeValores` sobrepõe `ramificacao.override` em cima de `valoresBase`.
- **Classificação é matching determinístico por prioridade.** `classificarCenario` percorre `regras.grupos` em ordem crescente de `prioridade`; vence o primeiro match de `condicoes`+`condicaoExtra`. `DEVOLUCAO` é tratado de forma especial em `validator.ts` (alerta fixo `I09`, não é cenário configurado).
- **Falhe ruidosamente.** Quando nenhum cenário casar e o item não for `VEDADO`, emita `DIVERGENCIA C-UNK` — nunca assuma OK por padrão. A mensagem precisa incluir CFOP / operação / tipoDest para que o usuário veja *por que* a classificação falhou.
- **BC integral para ICMS a recolher.** `calcularICMSRecolherItem` e `calcularFundosItem` sempre usam `bcIntegral(vBC, pRedBC)` — a redução de base de cálculo não diminui a obrigação de recolhimento. O mesmo vale para o CP esperado. É exigência legal; não "otimize" isso.
- **Cobre/Aço é um modificador (M01), não um cenário.** O grupo legado `A8` está com `ativo: false` em `defaultRegras.ts` — cobre/aço sobrescreve `cargaEfetiva` para 0,6% em cima do A1. Mantenha essa decomposição; não reintroduza o A8.
- **Uma única fonte de verdade para os resultados.** `rawNfes` + `canceladasSet` + `config` + `cnpjInfoMap` + `REGRAS` alimentam um `useEffect` em [src/App.tsx](src/App.tsx) que recomputa `results`. Nunca mute `results` diretamente em resposta a mudanças de config — reprocesse a partir de `rawNfes`.

### Simulador

[src/simulator/](src/simulator/) reaproveita o pipeline de vedação + classificador do auditor, mas aceita entradas sintéticas (`SimuladorParams` → `resolverCenario` → `calcularTTD`). Mantenha-o alinhado com [src/engine/classifier.ts](src/engine/classifier.ts) chamando as mesmas funções, não implementações paralelas.

### Apuração TTD vs Reconciliação

- [src/engine/apuracao.ts](src/engine/apuracao.ts) alimenta o `ReconciliacaoPanel` — agrupa por **cenário**.
- [src/engine/apuracaoTTD.ts](src/engine/apuracaoTTD.ts) alimenta a `ApuracaoTTDPage` — agrupa por **carga efetiva (1,0 / 2,1 / 3,6)** × operação × redução de BC, espelhando o relatório da contabilidade para o TTD 410 e calculando os quatro fundos (FUNDEC, FUMDES, Pró-Emprego, Fundo Social). Os dois coexistem de propósito; não consolide um no outro.

### Cross-Validação com EFD

[src/engine/efdParser.ts](src/engine/efdParser.ts) faz parse de arquivos `.txt` da EFD ICMS/IPI (delimitados por pipe, formatos BR de número/data). [src/engine/crossValidator.ts](src/engine/crossValidator.ts) reconcilia as NF-e parseadas contra os registros EFD C100/C113/C190/E110. Disparado em `App.tsx` quando XML e EFD estão carregados ao mesmo tempo.

## Firebase (Firestore)

Configuração em [src/firebase/config.ts](src/firebase/config.ts); contrato detalhado em [.cursor/rules/firebase.mdc](.cursor/rules/firebase.mdc). Projeto `auditor-nfs`, região `southamerica-east1`, **regras de leitura/escrita abertas** (ferramenta interna — não publicar sem adicionar Auth + regras restritas).

Coleções:
- `empresas/{cnpj}` — cache da API CNPJa, CNPJ de 14 dígitos como ID do documento (sem pontuação). Formato: `EmpresaFirestore` em [src/types/empresa.ts](src/types/empresa.ts).
- `config/ncmLists`, `config/cnpjOverrides`, `config/aliquotasInternas`, `config/empresasCadastradas` — dados de referência editáveis, carregados por [src/firebase/configService.ts](src/firebase/configService.ts). O cadastro `empresas` alimenta o `cnpjInfoMap` via `industrialOverride`.
- `auditorias/{id}` — histórico de execuções, escrito por `salvarAuditoria` ao final de `handleFiles`.
- `camexOverrides/*` — overrides manuais de classificação usados pela `ApuracaoTTDPage`.

A consulta de CNPJ é em **3 camadas**: `Map` em memória → Firestore `empresas/{cnpj}` → API pública CNPJa (último recurso, cacheia ao obter sucesso). `parseResponse()` extrai `CnpjInfo` de qualquer um dos formatos. Ao adicionar uma coleção: crie um service tipado em `src/firebase/`, um tipo em `src/types/`, uma regra Firestore no console, e mantenha os catches silenciosos (`console.error`) para que falhas do Firebase nunca derrubem a aplicação.

## Autenticação

Login é OAuth2 contra a **Gescomex** (credenciais no `.env`, ver [.env.example](.env.example) — `VITE_GESCOMEX_API_*`). O estado vive em [src/auth/](src/auth/); o [src/auth/AuthGate.tsx](src/auth/AuthGate.tsx) envolve a aplicação. Os tokens são persistidos via [src/auth/storage.ts](src/auth/storage.ts). Isso é *só login* — não protege escritas no Firestore, que continuam abertas.

## Invariantes que costumam morder

- **Allowlist de CFOP na camada App**: `ALLOWED_CFOPS = {5949, 6949, 5102, 6102}` em [src/App.tsx](src/App.tsx) decide quais NFs entram na validação. NFs fora da lista são contadas em `discardedByCfop`, mas mantidas em `rawNfes` para que o reprocessamento após mudanças de config funcione. Não as descarte antes.
- **Estornos são detectados sobre o pool completo**, antes dos filtros de CFOP/valor, porque as próprias NFs de estorno costumam ter CFOPs de entrada ou `vProd=0`. Veja o comentário "Primeira passada" em `handleFiles`.
- **Precedência de status**: `ERRO > DIVERGENCIA > AVISO > INFO > OK` (ver `resolveStatus` em [src/engine/validator.ts](src/engine/validator.ts)). `confianca` deriva tanto do `statusFinal` quanto da severidade dos `crossChecks` — não calcule isso separadamente.
- **Match de prefixo de NCM é normalizado** (pontos removidos) dos dois lados. Sempre remova os pontos antes de comparar contra `listaCamex` / `listaCobreAco` / `decreto2128`.
- **Prioridade de tipoDest**: `pf > pj_nc > sn > contribuinte > desconhecido`. Destinatário com CPF e CNPJ ao mesmo tempo é tratado como PF. Simples Nacional é detectado via `config.listaSN` (lista de CNPJ), não via a NF.
- **O build é estrito**: `tsconfig.app.json` tem `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax` e `allowImportingTsExtensions` — portanto imports **precisam** usar extensões `.ts` / `.tsx`. Siga o estilo existente.
- **Hash do commit do Git** é exposto à aplicação pelo plugin Vite `virtual:git-hash` ([vite.config.ts](vite.config.ts)) e exibido no badge de build da Sidebar.

## Testes

- `src/engine/__tests__/fixtures.ts` concentra builders de NF-e compartilhados. Prefira estender fixtures a embutir XML nos testes.
- Cada módulo do engine tem um `*.test.ts` correspondente. Novos cenários em `defaultRegras.ts` exigem um caso correspondente em `validator.test.ts` ou `cenarios.test.ts`.
- `scripts/*.test.ts` são scripts pontuais de auditoria, executados contra snapshots de dados reais — mantenha-os sob o runner separado `vitest.scripts.config.ts` para que não poluam o caminho de CI padrão.

## Documentos a consultar antes de mexer em lógica tributária

- [PRD-v2.md](PRD-v2.md) — matriz de cenários, hierarquia de vedações, referências legais.
- [RESUMO-COMPLETO-REGRAS-NEGOCIO.md](RESUMO-COMPLETO-REGRAS-NEGOCIO.md) — comportamento do engine + campos derivados.
- [public/docs/ttd410-regras-v3.yaml](public/docs/ttd410-regras-v3.yaml) e [public/docs/regras-validacao.md](public/docs/regras-validacao.md) — referência exibida dentro da aplicação, carregada pela `RegrasPage`.
- [.cursor/rules/firebase.mdc](.cursor/rules/firebase.mdc) — contrato do Firestore.
