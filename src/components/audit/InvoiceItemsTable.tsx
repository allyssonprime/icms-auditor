import type { ItemValidation } from '../../types/validation.ts';
import { formatCurrency, formatNCM } from '../../utils/formatters.ts';
import { cn } from '@/lib/utils';

interface InvoiceItemsTableProps {
  items: ItemValidation[];
  selectedItemIdx: number | null;
  onSelectItem: (idx: number) => void;
}

const statusPill: Record<string, string> = {
  OK: 'bg-green-100 text-green-700',
  INFO: 'bg-sky-100 text-sky-700',
  AVISO: 'bg-amber-100 text-amber-700',
  DIVERGENCIA: 'bg-red-100 text-red-700',
  ERRO: 'bg-red-100 text-red-700',
};

export function InvoiceItemsTable({ items, selectedItemIdx, onSelectItem }: InvoiceItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400">
        Selecione uma NF-e na tabela acima
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="bg-surface-container-low px-4 h-8 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
          Itens da NF-e <span className="text-slate-400 normal-case tracking-normal">({items.length})</span>
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-white border-b border-[var(--outline-variant)]/10 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-1.5 font-bold text-slate-400">#</th>
              <th className="px-3 py-1.5 font-bold text-slate-400">Descricao</th>
              <th className="px-3 py-1.5 font-bold text-slate-400">NCM</th>
              <th className="px-3 py-1.5 font-bold text-slate-400">CST</th>
              <th className="px-3 py-1.5 font-bold text-slate-400">CFOP</th>
              <th className="px-3 py-1.5 font-bold text-slate-400 text-right">BC ICMS</th>
              <th className="px-3 py-1.5 font-bold text-slate-400 text-right">ICMS</th>
              <th className="px-3 py-1.5 font-bold text-slate-400 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((iv, idx) => {
              const hasProblem = iv.statusFinal === 'DIVERGENCIA' || iv.statusFinal === 'ERRO';
              const isSelected = selectedItemIdx === idx;
              return (
                <tr
                  key={idx}
                  onClick={() => onSelectItem(idx)}
                  className={cn(
                    'h-8 cursor-pointer transition-colors border-b border-[var(--outline-variant)]/10',
                    hasProblem && 'bg-red-50/20',
                    isSelected && 'bg-blue-50/50',
                    !hasProblem && !isSelected && 'hover:bg-primary/5',
                  )}
                >
                  <td className="px-3 tabular-nums font-medium">{iv.item.nItem}</td>
                  <td className="px-3 truncate max-w-[200px]" title={iv.item.descricao}>{iv.item.descricao || '-'}</td>
                  <td className="px-3 tabular-nums font-mono">{formatNCM(iv.item.ncm)}</td>
                  <td className="px-3 tabular-nums">{iv.item.cstOrig}({iv.item.cst})</td>
                  <td className="px-3 tabular-nums">{iv.item.cfop}</td>
                  <td className="px-3 tabular-nums text-right">{formatCurrency(iv.item.vBC)}</td>
                  <td className={cn('px-3 tabular-nums text-right', hasProblem && 'text-red-600 font-bold')}>
                    {formatCurrency(iv.item.vICMS)}
                  </td>
                  <td className="px-3 text-center">
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase', statusPill[iv.statusFinal] ?? 'bg-slate-100 text-slate-500')}>
                      {iv.statusFinal === 'OK' ? 'OK' : iv.statusFinal === 'DIVERGENCIA' ? 'DIV' : iv.statusFinal.slice(0, 3)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
