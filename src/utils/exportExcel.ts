import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { NfeValidation } from '../types/validation.ts';
import { CENARIOS } from '../engine/cenarios.ts';

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportToExcel(results: NfeValidation[]): void {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo
  const resumoData = results.map(r => ({
    'NF-e': r.nfe.numero,
    'Serie': r.nfe.serie,
    'Emitente CNPJ': r.nfe.emitCnpj || '',
    'Emitente': r.nfe.emitNome || '',
    'Dest CNPJ/CPF': r.nfe.dest.cnpj || r.nfe.dest.cpf || '',
    'Destinatario': r.nfe.dest.nome,
    'UF': r.nfe.dest.uf,
    'IE': r.nfe.dest.ie || '',
    'indIEDest': r.nfe.dest.indIEDest,
    'Qtd Itens': r.itensValidados.length,
    'OK': r.itensValidados.filter(i => i.statusFinal === 'OK').length,
    'Alertas': r.itensValidados.filter(i => i.statusFinal === 'ALERTA').length,
    'Erros': r.itensValidados.filter(i => i.statusFinal === 'ERRO').length,
    'Status': r.statusFinal,
    'Total BC': r.totalBC,
    'ICMS Destacado': r.totalICMSDestacado,
    'ICMS Recolher': r.totalICMSRecolher,
    'Fundos 0,4%': r.totalFundos,
    'Total Recolher': r.totalRecolherComFundos,
  }));
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Aba 2: Detalhamento
  const detData = results.flatMap(r =>
    r.itensValidados.map(iv => {
      const cenario = CENARIOS[iv.cenario];
      return {
        'NF-e': r.nfe.numero,
        'Item': iv.item.nItem,
        'NCM': iv.item.ncm,
        'Descricao': iv.item.descricao,
        'CFOP': iv.item.cfop,
        'CST': iv.item.cst,
        'CST Orig': iv.item.cstOrig,
        'Aliquota NF': iv.item.pICMS,
        'Aliq. Esperada': cenario ? cenario.aliquotasAceitas.join('/') : '-',
        'BC': iv.item.vBC,
        'ICMS': iv.item.vICMS,
        'pRedBC': iv.item.pRedBC || '',
        'Cenario': iv.cenario,
        'Status': iv.statusFinal,
        'CP Codigo': iv.item.cCredPresumido || '',
        'CP %': iv.item.pCredPresumido || '',
        'CP Valor': iv.item.vCredPresumido || '',
        'Observacoes': iv.resultados
          .filter(r => r.status !== 'OK')
          .map(r => `[${r.regra}] ${r.mensagem}`)
          .join(' | '),
        'Cross-Checks': iv.crossChecks
          .map(ck => `[${ck.severity}] ${ck.label}`)
          .join(' | '),
      };
    }),
  );
  const wsDet = XLSX.utils.json_to_sheet(detData);
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalhamento');

  // Aba 3: Regras
  const regrasData = results.flatMap(r =>
    r.itensValidados.flatMap(iv =>
      iv.resultados.map(res => ({
        'NF-e': r.nfe.numero,
        'Item': iv.item.nItem,
        'NCM': iv.item.ncm,
        'Regra': res.regra,
        'Status': res.status,
        'Mensagem': res.mensagem,
      })),
    ),
  );
  const wsRegras = XLSX.utils.json_to_sheet(regrasData);
  XLSX.utils.book_append_sheet(wb, wsRegras, 'Regras');

  // Aba 4: Fundos e Totais
  const fundosData = results.map(r => ({
    'NF-e': r.nfe.numero,
    'Destinatario': r.nfe.dest.nome,
    'UF': r.nfe.dest.uf,
    'Total BC': r.totalBC,
    'ICMS Destacado': r.totalICMSDestacado,
    'ICMS Recolher': r.totalICMSRecolher,
    'Fundos 0,4%': r.totalFundos,
    'Total Recolher + Fundos': r.totalRecolherComFundos,
  }));
  const wsFundos = XLSX.utils.json_to_sheet(fundosData);
  XLSX.utils.book_append_sheet(wb, wsFundos, 'Fundos e Totais');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  saveAs(blob, `auditoria-nfe-${formatDate()}.xlsx`);
}
