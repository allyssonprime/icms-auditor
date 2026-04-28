import type { NfeData, ItemData } from '../types/nfe.ts';
import type { NfeValidation, ItemValidation, ValidationResult, StatusType, CrossCheck, CnpjInfo, ConfiancaType } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { verificarVedacoes } from './vedacoes.ts';
import { classificarCenario, computarCamposDerivados } from './classifier.ts';
import { getCenarios } from './cenarios.ts';
import { validarAliquota } from './aliquota.ts';
import { validarCST } from './cst.ts';
import { validarCFOP } from './cfop.ts';
import { validarBaseCalculo, isBcConsistente } from './bcValidation.ts';
import { validarCreditoPresumido } from './cpValidation.ts';
import { validarInfoComplementares } from './infCplValidation.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { REGRAS } from '../data/defaultRegras.ts';
import { bcIntegral } from '../utils/formatters.ts';
import { deriveCargaEfetiva, calcularICMSRecolherItem, calcularFundosItem } from './calculoHelpers.ts';

function resolveStatus(results: ValidationResult[]): StatusType {
  if (results.some(r => r.status === 'ERRO')) return 'ERRO';
  if (results.some(r => r.status === 'DIVERGENCIA')) return 'DIVERGENCIA';
  if (results.some(r => r.status === 'AVISO')) return 'AVISO';
  if (results.some(r => r.status === 'INFO')) return 'INFO';
  return 'OK';
}

function validarItem(
  nfe: NfeData,
  item: ItemData,
  config: AppConfig,
  regras: RegrasConfig,
  cenariosMap: Record<string, import('../types/cenario.ts').CenarioConfig>,
  cnpjInfoMap?: Map<string, CnpjInfo>,
): ItemValidation {
  const resultados: ValidationResult[] = [];
  let crossChecks: CrossCheck[] = [];

  // Etapa 1: Vedacoes (bloqueante)
  const vedacoes = verificarVedacoes(item, nfe, config, regras);
  resultados.push(...vedacoes);
  const bloqueado = vedacoes.some(v => v.status === 'ERRO');

  // Etapa 2: Computar campos derivados + classificar cenario
  const derivados = bloqueado ? null : computarCamposDerivados(item, nfe.dest, config, regras, undefined, cnpjInfoMap);
  const cenarioId = bloqueado ? 'VEDADO' : classificarCenario(item, nfe.dest, config, regras, undefined, cnpjInfoMap);
  const cenario = cenariosMap[cenarioId];

  if (!bloqueado && cenarioId === 'DEVOLUCAO') {
    resultados.push({
      status: 'INFO',
      mensagem: 'Devolução detectada. Estornar crédito presumido (item 1.20). Fundos: creditar via DCIP 54.',
      regra: 'I09',
      cenario: 'DEVOLUCAO',
    });
  } else if (!bloqueado && cenario) {
    // Etapa 3: Validar aliquota + cross-checks
    const aliqResult = validarAliquota(item, cenario, nfe.dest, config, cnpjInfoMap, regras);
    resultados.push(aliqResult.result);
    crossChecks = aliqResult.crossChecks;
    // M01: Modificador cobre/aço — INFO sobre recolhimento diferenciado
    if (derivados?.isCobreAco) {
      resultados.push({
        status: 'INFO',
        mensagem: 'NCM de aço/cobre. Recolhimento ICMS reduzido de 1,0% para 0,6%.',
        regra: 'M01',
        cenario: cenarioId,
      });
    }
    // Etapa 3b: Validar consistência da base de cálculo
    resultados.push(...validarBaseCalculo(item));
    // Etapa 3c: Validar crédito presumido
    resultados.push(...validarCreditoPresumido(item, cenario));
    // Etapa 4: Validar CST
    resultados.push(validarCST(item, cenario, derivados?.isCAMEX));
    // Etapa 5: Validar CFOP
    resultados.push(validarCFOP(item, cenario));
    // Etapa 6: Validar informações complementares (infCpl)
    resultados.push(...validarInfoComplementares(nfe.infCpl, cenario, item));

    // Etapa 7: Observacoes informativas sobre o cenario
    // PF_SEM_TTD — pessoa fisica nao usa TTD (recolhimento integral)
    if (derivados?.tipoDest === 'pf' && cenario.cargaEfetiva < 0) {
      resultados.push({
        status: 'INFO',
        mensagem: 'Destinatário pessoa física. TTD não se aplica — recolhimento integral.',
        regra: 'I10',
        cenario: cenarioId,
      });
    }
    // TRANSF — transferencia entre estabelecimentos
    if (derivados?.cfopMatch === 'transferencia') {
      resultados.push({
        status: 'INFO',
        mensagem: 'Transferência entre estabelecimentos. Sem crédito presumido.',
        regra: 'I11',
        cenario: cenarioId,
      });
    }
    // CAMEX_21 — opcao de recolhimento alternativo 2,1% (B2/B2-Industrial apenas)
    if ((cenarioId === 'B2' || cenarioId === 'B2-Industrial') && Math.abs(item.pICMS - 12) < 0.01) {
      resultados.push({
        status: 'INFO',
        mensagem: 'Cenário CAMEX com opção de recolhimento 2,1% (alternativa ao 3,6%).',
        regra: 'I12',
        cenario: cenarioId,
      });
    }
  } else if (!bloqueado) {
    // Linha "orfa" — nenhum grupo de regras casou com os campos derivados.
    // Incluir CFOP/operacao/tipoDest na mensagem ajuda a diagnosticar por que
    // ficou sem cenario (ex.: CFOP 5910/5915 fora dos grupos padrao, ou
    // combinacao operacao/tipoDest nao mapeada).
    const ctx = derivados
      ? `CFOP ${item.cfop} (match=${derivados.cfopMatch}), operacao=${derivados.operacao}, dest=${derivados.tipoDest}`
      : `CFOP ${item.cfop}`;
    resultados.push({
      status: 'DIVERGENCIA',
      mensagem: `Cenario nao identificado (${ctx}). Verificar se o CFOP/operacao deveria ser coberto por algum grupo de regras, ou se e uma operacao especial (remessa, conserto, consignacao, transferencia).`,
      regra: 'C-UNK',
    });
  }

  const statusFinal = resolveStatus(resultados);

  let confianca: ConfiancaType;
  if (statusFinal === 'ERRO' || statusFinal === 'DIVERGENCIA' || crossChecks.some(ck => ck.severity === 'divergente')) {
    confianca = 'baixa';
  } else if (statusFinal === 'AVISO' || statusFinal === 'INFO' || crossChecks.some(ck => ck.severity === 'atencao')) {
    confianca = 'media';
  } else {
    confianca = 'alta';
  }

  return {
    item,
    cenario: cenarioId,
    resultados,
    crossChecks,
    statusFinal,
    confianca,
    bcConsistente: isBcConsistente(resultados),
  };
}

export function validarNfe(
  nfe: NfeData,
  config: AppConfig,
  cnpjInfoMap?: Map<string, CnpjInfo>,
  regras?: RegrasConfig,
): NfeValidation {
  const r = regras ?? REGRAS;
  const cenariosMap = getCenarios(r);

  const itensValidados = nfe.itens.map(item => validarItem(nfe, item, config, r, cenariosMap, cnpjInfoMap));

  const statusFinal = resolveStatus(
    itensValidados.flatMap(iv => iv.resultados),
  );

  const totalBC = itensValidados.reduce((s, iv) => s + iv.item.vBC, 0);
  const totalICMSDestacado = itensValidados.reduce((s, iv) => s + iv.item.vICMS, 0);

  // ICMS a recolher = carga efetiva sobre BC
  let totalICMSRecolher = 0;
  let totalFundos = 0;
  let totalCPDeclarado = 0;
  let totalCPEsperado = 0;

  for (const iv of itensValidados) {
    const cenario = cenariosMap[iv.cenario];
    if (!cenario) continue;
    const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
    const isCA = isCobreAco(iv.item.ncm, config.listaCobreAco);

    // ICMS a recolher e fundos: SEMPRE sobre BC integral × carga efetiva
    // (regra fiscal — a reducao de BC nao reduz a obrigacao de recolhimento).
    totalICMSRecolher += calcularICMSRecolherItem(iv.item, cenario, isCA);
    totalFundos += calcularFundosItem(iv.item, cenario);

    // Totais de CP — CP esperado tambem eh sobre a BC integral, mesmo
    // quando ha reducao de BC declarada.
    totalCPDeclarado += iv.item.vCredPresumido || 0;
    const cargaEfetiva = deriveCargaEfetiva(iv.item.pICMS, cenario, isCA);
    if (cenario.temCP && cargaEfetiva >= 0 && iv.item.pICMS > cargaEfetiva) {
      totalCPEsperado += bc * ((iv.item.pICMS - cargaEfetiva) / 100);
    }
  }

  const totalRecolherComFundos = totalICMSRecolher + totalFundos;

  return {
    nfe,
    itensValidados,
    statusFinal,
    totalBC,
    totalICMSDestacado,
    totalICMSRecolher,
    totalFundos,
    totalRecolherComFundos,
    totalCPDeclarado,
    totalCPEsperado,
  };
}
