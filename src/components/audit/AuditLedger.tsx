import { useState, useMemo } from 'react';
import type { NfeValidation, CnpjInfo } from '../../types/validation.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { isNaoContribuinte } from '../../engine/aliquota.ts';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortKey = 'numero' | 'emitente' | 'destinatario' | 'uf' | 'itens' | 'bc' | 'icms' | 'status';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 50;

interface AuditLedgerProps {
  results: NfeValidation[];
  cnpjInfoMap?: Map<string, CnpjInfo>;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}

const statusPill: Record<string, string> = {
  OK: 'bg-green-100 text-green-700',
  INFO: 'bg-sky-100 text-sky-700',
  AVISO: 'bg-amber-100 text-amber-700',
  DIVERGENCIA: 'bg-red-100 text-red-700',
  ERRO: 'bg-red-100 text-red-700',
};

const statusLabel: Record<string, string> = {
  OK: 'OK',
  INFO: 'Info',
  AVISO: 'Aviso',
  DIVERGENCIA: 'Diverg.',
  ERRO: 'Erro',
};

function sortNfes(data: NfeValidation[], key: SortKey, dir: SortDir): NfeValidation[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...data].sort((a, b) => {
    switch (key) {
      case 'numero': return m * a.nfe.numero.localeCompare(b.nfe.numero, undefined, { numeric: true });
      case 'emitente': return m * a.nfe.emitNome.localeCompare(b.nfe.emitNome);
      case 'destinatario': return m * a.nfe.dest.nome.localeCompare(b.nfe.dest.nome);
      case 'uf': return m * a.nfe.dest.uf.localeCompare(b.nfe.dest.uf);
      case 'itens': return m * (a.itensValidados.length - b.itensValidados.length);
      case 'bc': return m * (a.totalBC - b.totalBC);
      case 'icms': return m * (a.totalICMSDestacado - b.totalICMSDestacado);
      case 'status': {
        const order: Record<string, number> = { ERRO: 0, DIVERGENCIA: 1, AVISO: 2, INFO: 3, OK: 4 };
        return m * ((order[a.statusFinal] ?? 5) - (order[b.statusFinal] ?? 5));
      }
      default: return 0;
    }
  });
}

export function AuditLedger({ results, cnpjInfoMap, selectedIdx, onSelect }: AuditLedgerProps) {
  const [sortKey, setSortKey] = useState<SortKey>('bc');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => sortNfes(results, sortKey, sortDir), [results, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'bc' || key === 'icms' || key === 'itens' ? 'desc' : 'asc'); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={10} className="text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp size={10} className="text-primary" /> : <ChevronDown size={10} className="text-primary" />;
  };

  const cols: [SortKey, string, string][] = [
    ['numero', 'NF', 'text-left'],
    ['emitente', 'Emitente / CNPJ', 'text-left'],
    ['destinatario', 'Destinatario', 'text-left'],
    ['uf', 'UF', 'text-left'],
    ['itens', 'Itens', 'text-right'],
    ['bc', 'Base ICMS', 'text-right'],
    ['icms', 'ICMS', 'text-right'],
    ['status', 'Status', 'text-center'],
  ];

  return (
    <div className="bg-white rounded-lg border border-[var(--outline-variant)]/15 flex flex-col overflow-hidden shadow-[0_12px_32px_-4px_rgba(19,27,46,0.08)]">
      <div className="bg-surface-container-low px-4 h-9 flex items-center shrink-0">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Notas Fiscais</span>
        <span className="text-[10px] text-slate-400 ml-2 tabular-nums">{results.length}</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-white border-b border-[var(--outline-variant)]/20 z-10">
            <tr>
              {cols.map(([key, label, align]) => (
                <th
                  key={key}
                  className={cn('px-4 py-2 font-bold text-slate-500 uppercase tracking-tighter cursor-pointer select-none hover:text-slate-700 transition-colors', align)}
                  onClick={() => handleSort(key)}
                >
                  <span className="inline-flex items-center gap-1">{label} <SortIcon col={key} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pageData.map((v, idx) => {
              const globalIdx = safePage * PAGE_SIZE + idx;
              const isSelected = selectedIdx === globalIdx;
              const info = v.nfe.dest.cnpj ? cnpjInfoMap?.get(v.nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
              const hasProblem = v.statusFinal === 'DIVERGENCIA' || v.statusFinal === 'ERRO';
              return (
                <tr
                  key={globalIdx}
                  onClick={() => onSelect(globalIdx)}
                  className={cn(
                    'h-8 hover:bg-primary/5 cursor-pointer transition-colors',
                    isSelected && 'bg-blue-50/50',
                  )}
                >
                  <td className="px-4 tabular-nums font-semibold">{v.nfe.numero}</td>
                  <td className="px-4">
                    <span className="font-medium">{v.nfe.emitNome?.slice(0, 25) || '-'}</span>
                    {v.nfe.emitCnpj && <span className="text-slate-400 text-[10px] ml-1">{v.nfe.emitCnpj.replace(/\D/g, '').slice(0, 8)}</span>}
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="truncate max-w-[180px]">{(info?.razaoSocial || v.nfe.dest.nome)?.slice(0, 28)}</span>
                      {v.nfe.dest.cnpj && <span className="text-slate-400 text-[10px] font-mono">{v.nfe.dest.cnpj.replace(/\D/g, '').slice(0, 8)}</span>}
                      {info?.simplesOptante === true && <span className="text-[9px] px-1 py-0 rounded bg-orange-100 text-orange-700 font-bold">SN</span>}
                      {info?.isMei === true && <span className="text-[9px] px-1 py-0 rounded bg-purple-100 text-purple-700 font-bold">MEI</span>}
                      {info?.isIndustrial && <span className="text-[9px] px-1 py-0 rounded bg-blue-100 text-blue-700 font-bold">Ind</span>}
                      {isNaoContribuinte(v.nfe.dest) && <span className="text-[9px] px-1 py-0 rounded bg-slate-100 text-slate-600 font-bold">NC</span>}
                    </div>
                  </td>
                  <td className="px-4 tabular-nums">
                    {v.nfe.emitUF} <span className="text-slate-400">&rarr;</span> {v.nfe.dest.uf}
                  </td>
                  <td className="px-4 tabular-nums text-right">{v.itensValidados.length}</td>
                  <td className="px-4 tabular-nums text-right">{formatCurrency(v.totalBC)}</td>
                  <td className={cn('px-4 tabular-nums text-right', hasProblem && 'text-red-600 font-bold')}>
                    {formatCurrency(v.totalICMSDestacado)}
                  </td>
                  <td className="px-4 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', statusPill[v.statusFinal] ?? 'bg-slate-100 text-slate-500')}>
                      {statusLabel[v.statusFinal] ?? v.statusFinal}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--outline-variant)]/10 shrink-0">
          <span className="text-[11px] text-slate-500">
            Exibindo {safePage * PAGE_SIZE + 1}&ndash;{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 flex items-center justify-center rounded border border-[var(--outline-variant)]/20 hover:bg-slate-50 disabled:opacity-30" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
              const p = start + i;
              return (
                <button key={p} className={cn('w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold', p === safePage ? 'border border-primary bg-primary-fixed/30 text-primary' : 'border border-[var(--outline-variant)]/20 hover:bg-slate-50 text-slate-600')} onClick={() => setPage(p)}>
                  {p + 1}
                </button>
              );
            })}
            <button className="w-7 h-7 flex items-center justify-center rounded border border-[var(--outline-variant)]/20 hover:bg-slate-50 disabled:opacity-30" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
