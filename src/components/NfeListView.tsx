import { useState, useMemo } from 'react';
import type { NfeValidation, ActiveFilters, CnpjInfo } from '../types/validation.ts';
import { NfeCard } from './NfeCard.tsx';
import { formatCNPJ, formatCurrency } from '../utils/formatters.ts';
import { isNaoContribuinte } from '../engine/aliquota.ts';
import { TableProperties, LayoutGrid, FileText, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { RegrasConfig } from '../types/regras.ts';

type SortKey = 'numero' | 'emitente' | 'destinatario' | 'uf' | 'itens' | 'bc' | 'icms' | 'status';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 50;

interface NfeListViewProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  regras: RegrasConfig;
}

const statusBadge: Record<string, string> = {
  OK: 'bg-success-100 text-success-700 border-success-200',
  INFO: 'bg-sky-100 text-sky-700 border-sky-200',
  AVISO: 'bg-warning-100 text-warning-700 border-warning-200',
  DIVERGENCIA: 'bg-orange-100 text-orange-700 border-orange-200',
  ERRO: 'bg-danger-100 text-danger-700 border-danger-200',
};

function matchesFilters(v: NfeValidation, filters: ActiveFilters, cnpjInfoMap?: Map<string, CnpjInfo>): boolean {
  const hasAny =
    filters.aliquota.size > 0 ||
    filters.cst.size > 0 ||
    filters.cfop.size > 0 ||
    filters.cenario.size > 0 ||
    filters.status.size > 0 ||
    filters.vedado.size > 0 ||
    filters.creditoPresumido.size > 0 ||
    filters.tipoOperacao.size > 0 ||
    filters.confianca.size > 0 ||
    filters.searchText.length > 0;

  if (!hasAny) return true;

  // Text search: match against CNPJ, IE, razao social, emitente, numero and item NCM
  if (filters.searchText.length > 0) {
    const q = filters.searchText.toLowerCase().trim().replace(/[.\-/]/g, '');
    const destCnpj = (v.nfe.dest.cnpj ?? '').replace(/\D/g, '');
    const destIe = (v.nfe.dest.ie ?? '').replace(/\D/g, '');
    const destNome = v.nfe.dest.nome.toLowerCase();
    const emitCnpj = v.nfe.emitCnpj.replace(/\D/g, '');
    const emitNome = v.nfe.emitNome.toLowerCase();
    const numero = v.nfe.numero;
    const itemNcms = v.itensValidados.map(iv =>
      (iv.item.ncm ?? '').toLowerCase().replace(/[.\-/]/g, '')
    );

    const info = v.nfe.dest.cnpj ? cnpjInfoMap?.get(v.nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
    const razaoSocial = (info?.razaoSocial ?? '').toLowerCase();

    const match =
      destCnpj.includes(q) ||
      destIe.includes(q) ||
      destNome.includes(q) ||
      emitCnpj.includes(q) ||
      emitNome.includes(q) ||
      numero.includes(q) ||
      razaoSocial.includes(q) ||
      itemNcms.some(ncm => ncm.includes(q));

    if (!match) return false;
  }

  // Status filter applies at NF level
  if (filters.status.size > 0 && !filters.status.has(v.statusFinal)) return false;

  // Tipo operacao filter at NF level
  if (filters.tipoOperacao.size > 0) {
    const tipo = v.nfe.dest.uf.toUpperCase() === 'SC' ? 'Interna' : 'Interestadual';
    if (!filters.tipoOperacao.has(tipo)) return false;
  }

  // Item-level filters
  const hasItemFilters =
    filters.aliquota.size > 0 ||
    filters.cst.size > 0 ||
    filters.cfop.size > 0 ||
    filters.cenario.size > 0 ||
    filters.vedado.size > 0 ||
    filters.creditoPresumido.size > 0 ||
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

export function NfeListView({ results, filters, cnpjInfoMap, regras }: NfeListViewProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('bc');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => results.filter(v => matchesFilters(v, filters, cnpjInfoMap)),
    [results, filters, cnpjInfoMap],
  );

  const sorted = useMemo(
    () => sortNfes(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const totalBC = filtered.reduce((s, r) => s + r.totalBC, 0);
  const totalICMS = filtered.reduce((s, r) => s + r.totalICMSDestacado, 0);
  const totalItens = filtered.reduce((s, r) => s + r.itensValidados.length, 0);

  if (results.length === 0) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'bc' || key === 'icms' || key === 'itens' ? 'desc' : 'asc');
    }
    setPage(0);
    setSelectedIdx(null);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="text-muted-foreground/40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />;
  };

  return (
    <Card className="shadow-card border-0 bg-white/70 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/40">
        <CardTitle className="text-base flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
            <FileText size={16} className="text-primary" aria-hidden />
          </div>
          Notas Fiscais
          {filtered.length !== results.length ? (
            <Badge variant="secondary" className="ml-1 text-[10px] font-mono">{filtered.length} de {results.length}</Badge>
          ) : (
            <Badge variant="secondary" className="ml-1 text-[10px] font-mono">{results.length}</Badge>
          )}
        </CardTitle>
        <div className="flex gap-1 bg-neutral-100/80 backdrop-blur-md rounded-xl p-1 shadow-inner">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setView('table'); setSelectedIdx(null); }}
            className={cn("text-xs h-8 rounded-lg", view === 'table' && "bg-white shadow-sm text-primary font-semibold")}
          >
            <TableProperties size={14} className="mr-1.5" aria-hidden />
            Tabela
          </Button>
          <Button
            variant={view === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setView('cards'); setSelectedIdx(null); }}
            className={cn("text-xs h-8 rounded-lg", view === 'cards' && "bg-white shadow-sm text-primary font-semibold")}
          >
            <LayoutGrid size={14} className="mr-1.5" aria-hidden />
            Cards
          </Button>
        </div>
      </CardHeader>

      {view === 'table' && (
        <>
          <div className="overflow-x-auto border-t border-border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-surface-container-low">
                  {([
                    ['numero', 'NF', 'text-left'],
                    ['emitente', 'Emitente', 'text-left'],
                    ['destinatario', 'Destinatario', 'text-left'],
                    ['uf', 'UF', 'text-left'],
                    ['itens', 'Itens', 'text-right'],
                    ['bc', 'BC ICMS', 'text-right'],
                    ['icms', 'ICMS', 'text-right'],
                    ['status', 'Status', 'text-center'],
                  ] as [SortKey, string, string][]).map(([key, label, align]) => (
                    <TableHead
                      key={key}
                      className={cn(
                        'text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-2 h-auto cursor-pointer select-none hover:text-foreground transition-colors',
                        align,
                      )}
                      onClick={() => handleSort(key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map((v, idx) => {
                  const globalIdx = safePage * PAGE_SIZE + idx;
                  return (
                  <TableRow
                    key={globalIdx}
                    onClick={() => setSelectedIdx(selectedIdx === globalIdx ? null : globalIdx)}
                    className={cn(
                      'cursor-pointer',
                      idx % 2 === 0 ? 'bg-card' : 'bg-muted/50',
                      selectedIdx === globalIdx && 'bg-primary-50 border-l-2 border-l-primary-500'
                    )}
                  >
                    <TableCell className="px-3 py-2 font-mono font-medium text-foreground">{v.nfe.numero}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate max-w-[150px] text-foreground font-mono text-[11px]" title={v.nfe.emitNome}>
                          {v.nfe.emitCnpj ? formatCNPJ(v.nfe.emitCnpj) : '-'}
                        </span>
                        {v.nfe.emitNome && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={v.nfe.emitNome}>{v.nfe.emitNome}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {(() => {
                        const info = v.nfe.dest.cnpj ? cnpjInfoMap?.get(v.nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
                        const isNC = isNaoContribuinte(v.nfe.dest);
                        const nome = info?.razaoSocial || v.nfe.dest.nome;
                        const cnaeText = info?.cnaeDescricao ? `${info.cnaePrincipal} - ${info.cnaeDescricao}` : '';
                        return (
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="truncate max-w-[200px] text-foreground" title={v.nfe.dest.nome}>
                                {v.nfe.dest.cnpj ? formatCNPJ(v.nfe.dest.cnpj) : v.nfe.dest.cpf || '-'}
                              </span>
                              {isNC ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-foreground shrink-0">NC</Badge>
                              ) : (
                                <>
                                  {info?.simplesOptante === true && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700 border-orange-200 shrink-0">SN</Badge>
                                  )}
                                  {info?.isIndustrial && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700 border-blue-200 shrink-0">Ind</Badge>
                                  )}
                                </>
                              )}
                            </div>
                            {nome && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={nome}>{nome}</div>
                            )}
                            {cnaeText && (
                              <div className="text-[10px] text-muted-foreground/70 truncate max-w-[200px]" title={cnaeText}>{cnaeText}</div>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-muted-foreground">{v.nfe.dest.uf}</TableCell>
                    <TableCell className="px-3 py-2 text-right text-muted-foreground tabular-nums">{v.itensValidados.length}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{formatCurrency(v.totalBC)}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{formatCurrency(v.totalICMSDestacado)}</TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <Badge className={cn('text-[10px]', statusBadge[v.statusFinal] ?? 'bg-muted text-muted-foreground border-border')}>
                        {v.statusFinal}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted font-semibold border-t-2 border-border">
                  <TableCell className="px-3 py-2 text-foreground" colSpan={4}>Total ({filtered.length} NF-e)</TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums text-muted-foreground">{totalItens}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{formatCurrency(totalBC)}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{formatCurrency(totalICMS)}</TableCell>
                  <TableCell className="px-3 py-2" />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-[11px] text-slate-500 font-medium">
                Exibindo {safePage * PAGE_SIZE + 1}&ndash;{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} de {sorted.length} notas
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={safePage === 0}
                  onClick={() => { setPage(p => p - 1); setSelectedIdx(null); }}
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft size={16} />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                  const p = start + i;
                  return (
                    <button
                      key={p}
                      className={cn(
                        'w-8 h-8 flex items-center justify-center rounded text-[10px] font-bold transition-colors',
                        p === safePage
                          ? 'border border-primary bg-primary-100/30 text-primary'
                          : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                      )}
                      onClick={() => { setPage(p); setSelectedIdx(null); }}
                    >
                      {p + 1}
                    </button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => { setPage(p => p + 1); setSelectedIdx(null); }}
                  aria-label="Proxima pagina"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {selectedIdx !== null && sorted[selectedIdx] && (
            <NfeCard validation={sorted[selectedIdx]} cnpjInfoMap={cnpjInfoMap} regras={regras} />
          )}
        </>
      )}

      {view === 'cards' && (
        <div className="px-6 pb-6 space-y-3">
          {sorted.slice(0, PAGE_SIZE).map((r, idx) => (
            <NfeCard key={idx} validation={r} cnpjInfoMap={cnpjInfoMap} regras={regras} />
          ))}
          {sorted.length > PAGE_SIZE && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Mostrando {PAGE_SIZE} de {sorted.length} NF-e. Use a visualizacao em tabela para paginacao completa.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
