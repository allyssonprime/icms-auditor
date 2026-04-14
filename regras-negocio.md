# Regras de Negócio e TTD - ICMS Auditor e Simulador

Esta documentação contém as principais regras negociais, validações (vedações) e cross-checks do ICMS extraídas do motor de cálculo (`src/engine/`).
Essas regras são a base de parametrização para qualquer projeto derivado.

## 1. Cenários de Operação (TTD)

Estes são os perfis de operações padrão. Cada cenário determina a carga final esperada, se há diferimento e quais CFOP/CSTs originais se aplicam. 
Também está disponível no formato `regras-cenarios.json`.

- **A1**: Interestadual — Contribuinte (Normal ou SN) — Sem CAMEX (`4%`) | CFOP: 6101/6102/6106/6107 | CST: 90
- **A2**: Interestadual — Contribuinte — CAMEX (`12%, 7%`) | CFOP: 6101/6102/6106/6107 | CST: 90
- **A4**: Interestadual — PJ Não Contribuinte — Sem CAMEX (`4%`) | CFOP: 6101/6102/6107/6108 | CST: 90
- **A5**: Interestadual — PJ Não Contribuinte — CAMEX (`12%, 7%`) | CFOP: 6101/6102/6107/6108 | CST: 90
- **A6**: Interestadual — Pessoa Física outra UF — Sem CAMEX (`4%`) | CFOP: 6101/6102/6107/6108 | CST: 90
- **A7**: Interestadual — Pessoa Física outra UF — CAMEX (`12%, 7%`) | CFOP: 6101/6102/6107/6108 | CST: 90
- **A8**: Interestadual — Cobre/Aço — Contribuinte (`4%`) | Carga: 0.6 | CFOP: 6101/6102/6106/6107
- **A9**: Transferência interestadual (filial) (`4%, 12%, 7%`) | CFOP: 6152/6155
- **B1**: Interna — Contribuinte Normal — Sem CAMEX (`4%`) | CFOP: 5101/5102/5106/5107 | Diferimento Parcial: SIM
- **B2**: Interna — Contribuinte Normal — CAMEX (padrão) (`12%`) | Carga: 3.6 | Diferimento Parcial: SIM
- **B3**: Interna — Industrial (MP c/ mudança NCM) — Opção (`10%, 4%`) | Carga: 3.6 | Diferimento Parcial: SIM
- **B4**: Interna — Simples Nacional + COM ST (`4%`) | CST: 10, 70
- **B4-CAMEX**: Interna — SN + COM ST + CAMEX (`12%`) | Carga: 3.6
- **B5**: Interna — Simples Nacional + SEM ST (`7%, 8.80%, 12%, 17%, 25%`) | Carga: 3.6 | CST: 00
- **B6**: Interna — PJ Não Contribuinte (`7%-25%`) | Carga: 3.6 | CST: 00
- **B7**: Interna — Pessoa Física (consumidor final) (`7%-25%`) | Carga: 0 | Fundos: 0 (Não tem Crédito Presumido)
- **B9**: Interna — Destinatário com TTD/diferimento (Pró-Emprego) | Carga: 0 | CST: 51
- **B10**: Interna — Destinatário têxtil/confecções (art.15 XXXIX) (`10%`) | Carga: 3.6
- **B11**: Interna — CD Exclusivo (Booster) (`10%`) | Carga: 1.0 (Diferimento Parcial SIM)
- **B12**: Transferência interna (filial SC) | Carga: 0 | CFOP: 5152/5155 | CST: 51

---

## 2. Regras de Vedação (vedacoes.ts)

A vedações invalidam a aplicação do TTD em uma operação específica.

- **V01**: NCM no Decreto 2.128 - O NCM da mercadoria consta no decreto, invalidando o uso do TTD. STATUS: `ERRO`.
- **V01-EXC**: Exceção SCxSC com alíquota de 12%+ sem crédito presumido - O NCM é vedado, porém a operação não está usando TTD, logo emite STATUS: `ALERTA`.
- **V02**: Mercadoria usada (CFOP 5922, 6922) - O TTD é vedado para mercadorias usadas. STATUS: `ERRO`.

---

## 3. Validação de Alíquotas e Crosschecks (aliquota.ts)

Os *crosschecks* (testes cruzados) são matrizes de validação adicionais aplicadas conforme a alíquota encontrada.
Cada cross-check tem uma classificação de severidade: `ok`, `atencao` e `divergente`.

### Se a Alíquota for 12%
Busca as seguintes validações (Exige ao menos 1 condição "OR" + Condições "AND"):
- **CK12A**: Origem deve ser importada (`CST orig = 6`)
- **CK12B**: O NCM deve constar na lista da CAMEX
- **CK12C**: Destinatário deve ser optante pelo Simples Nacional
- **CK12D**: Destinatário NÃO PODE ser "não-contribuinte" (`indIEDest=9` ou isento - MANDATÓRIO)

### Se a Alíquota for 10%
- **CK10A**: A remessa deve ser interna (`SC` para `SC`) (MANDATÓRIO)
- **CK10B**: Destinatário deve estar na lista de empresas industriais
- **CK10E**: CNAE deve ser de atividade industrial
- **CK10C**: Destinatário NÃO PODE ser do Simples Nacional (MANDATÓRIO)
- **CK10D**: Destinatário NÃO PODE ser não-contribuinte (MANDATÓRIO)

### Se a Alíquota for 4%
- **CK04A**: Destinatário NÃO DEVE ser do Simples Nacional (exceto se no cenário B4)
- **CK04B**: O CST Origem NÃO PODE ser 6 (caso seja importação via Camex, deveria ser 12%)
- **CK04C**: O CST Origem DEVE ser 1, 2, 3 ou 8

### Se a Alíquota for 17% ou mais
- **CK17A**: Operação tem "Base de Cálculo reduzida"? (Carga menor que a padrão)
- **CK17B**: Destinatário é Simples Nacional? (Atenção: SN não fundamenta redução se for a única causa)
- **CK17C**: Destinatário é não-contribuinte?

### Códigos de Erro Gerais de Parametrização TTD
- **AL00**: A alíquota não será validada (para operações de diferimento integral/transferências onde alíquota=0)
- **AL01**: A alíquota diverge ou está correta conforme cenário esperado.
- **AL02**: A alíquota bateu, mas os "Crosschecks" falharam (as justificativas como CAMEX / Simples não bateram).
- **AL06**: Uma alíquota maior (geralmente 10%) pode ser vantajosa (mais crédito pro cliente) do que usar 4%. (B3)
- **AL08**: A alíquota é 12% ou maior com TTD, mas faltou informar o Crédito Presumido (a não ser que BC seja reduzida).
- **AL09**: O cliente provavelmente abriu mão do TTD nessa NF-e (usa alíquota normal e sem crédito presumido).
