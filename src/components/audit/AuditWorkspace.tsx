import { useState, useMemo } from 'react';
import type { NfeValidation, ActiveFilters, CnpjInfo } from '../../types/validation.ts';
import type { RegrasConfig } from '../../types/regras.ts';
import { AuditLedger } from './AuditLedger.tsx';
import { InvoiceItemsTable } from './InvoiceItemsTable.tsx';
import { DiscrepancyPanel } from './DiscrepancyPanel.tsx';

interface AuditWorkspaceProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  regras: RegrasConfig;
}

function matchesFilters(v: NfeValidation, filters: ActiveFilters, cnpjInfoMap?: Map<string, CnpjInfo>): boolean {
  const hasAny =
    filters.aliquota.size > 0 || filters.cst.size > 0 || filters.cfop.size > 0 ||
    filters.cenario.size > 0 || filters.status.size > 0 || filters.vedado.size > 0 ||
    filters.creditoPresumido.size > 0 || filters.tipoOperacao.size > 0 ||
    filters.confianca.size > 0 || filters.searchText.length > 0;
  if (!hasAny) return true;

  if (filters.searchText.length > 0) {
    const q = filters.searchText.toLowerCase().trim().replace(/[.\-/]/g, '');
    const destCnpj = (v.nfe.dest.cnpj ?? '').replace(/\D/g, '');
    const destNome = v.nfe.dest.nome.toLowerCase();
    const emitCnpj = v.nfe.emitCnpj.replace(/\D/g, '');
    const emitNome = v.nfe.emitNome.toLowerCase();
    const numero = v.nfe.numero;
    const info = v.nfe.dest.cnpj ? cnpjInfoMap?.get(v.nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
    const razaoSocial = (info?.razaoSocial ?? '').toLowerCase();

    if (!(destCnpj.includes(q) || destNome.includes(q) || emitCnpj.includes(q) || emitNome.includes(q) || numero.includes(q) || razaoSocial.includes(q))) return false;
  }

  if (filters.status.size > 0 && !filters.status.has(v.statusFinal)) return false;

  if (filters.tipoOperacao.size > 0) {
    const tipo = v.nfe.dest.uf.toUpperCase() === 'SC' ? 'Interna' : 'Interestadual';
    if (!filters.tipoOperacao.has(tipo)) return false;
  }

  const hasItemFilters =
    filters.aliquota.size > 0 || filters.cst.size > 0 || filters.cfop.size > 0 ||
    filters.cenario.size > 0 || filters.vedado.size > 0 || filters.creditoPresumido.size > 0 ||
    filters.confianca.size > 0;

  if (hasItemFilters) {
    return v.itensValidados.some(iv => {
      if (filters.aliquota.size > 0 && !filters.aliquota.has(iv.item.pICMS)) return false;
      if (filters.cst.size > 0 && !filters.cst.has(iv.item.cst)) return false;
      if (filters.cfop.size > 0 && !filters.cfop.has(iv.item.cfop)) return false;
      if (filters.cenario.size > 0 && !filters.cenario.has(iv.cenario)) return false;
      if (filters.vedado.size > 0) {
        const isVedado = iv.cenario === 'VEDADO' ? 'Sim' : 'Nao';
        if (!filters.vedado.has(isVedado)) return false;
      }
      if (filters.creditoPresumido.size > 0) {
        const cpKey = iv.item.cCredPresumido ? `CP ${iv.item.cCredPresumido}` : 'Sem CP';
        if (!filters.creditoPresumido.has(cpKey)) return false;
      }
      if (filters.confianca.size > 0) {
        const labels = { alta: 'Alta', media: 'Media', baixa: 'Baixa' } as const;
        if (!filters.confianca.has(labels[iv.confianca])) return false;
      }
      return true;
    });
  }

  return true;
}

export function AuditWorkspace({ results, filters, cnpjInfoMap, regras }: AuditWorkspaceProps) {
  const [selectedNfIdx, setSelectedNfIdx] = useState<number | null>(null);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);

  const filtered = useMemo(
    () => results.filter(v => matchesFilters(v, filters, cnpjInfoMap)),
    [results, filters, cnpjInfoMap],
  );

  const selectedNf = selectedNfIdx !== null ? filtered[selectedNfIdx] : null;
  const selectedItem = selectedNf && selectedItemIdx !== null ? selectedNf.itensValidados[selectedItemIdx] : null;

  const handleNfSelect = (idx: number) => {
    setSelectedNfIdx(idx);
    setSelectedItemIdx(null); // Reset item selection when NF changes
  };

  // Active filter chips
  const activeChips: { label: string; type: string }[] = [];
  if (filters.status.size > 0) filters.status.forEach(s => activeChips.push({ label: s, type: 'status' }));
  if (filters.aliquota.size > 0) filters.aliquota.forEach(a => activeChips.push({ label: `${a}%`, type: 'aliquota' }));
  if (filters.cenario.size > 0) filters.cenario.forEach(c => activeChips.push({ label: c, type: 'cenario' }));
  if (filters.searchText) activeChips.push({ label: `"${filters.searchText}"`, type: 'search' });

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-180px)]">
      {/* Tooling bar - active filters */}
      {activeChips.length > 0 && (
        <div className="h-9 bg-white border border-[var(--outline-variant)]/15 rounded-lg flex items-center px-4 gap-3 shrink-0">
          {activeChips.map((chip, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-primary-fixed/30 text-primary text-[10px] font-bold uppercase">
              {chip.label}
            </span>
          ))}
          <span className="text-[11px] text-slate-400 ml-auto">
            {filtered.length} de {results.length} NF-e
          </span>
        </div>
      )}

      {/* Main Audit Ledger */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AuditLedger
          results={filtered}
          cnpjInfoMap={cnpjInfoMap}
          selectedIdx={selectedNfIdx}
          onSelect={handleNfSelect}
        />
      </div>

      {/* Detail Split Pane */}
      <div className="h-72 grid grid-cols-12 gap-3 shrink-0">
        <div className="col-span-8 bg-white rounded-lg border border-[var(--outline-variant)]/15 overflow-hidden shadow-[0_12px_32px_-4px_rgba(19,27,46,0.08)]">
          <InvoiceItemsTable
            items={selectedNf?.itensValidados ?? []}
            selectedItemIdx={selectedItemIdx}
            onSelectItem={setSelectedItemIdx}
          />
        </div>
        <div className="col-span-4 bg-white rounded-lg border border-[var(--outline-variant)]/15 overflow-hidden shadow-[0_12px_32px_-4px_rgba(19,27,46,0.08)]">
          <DiscrepancyPanel
            item={selectedItem}
            nfe={selectedNf}
            cnpjInfoMap={cnpjInfoMap}
            regras={regras}
          />
        </div>
      </div>
    </div>
  );
}
