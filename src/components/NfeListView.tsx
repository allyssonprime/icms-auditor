import { useState } from 'react';
import type { NfeValidation, ActiveFilters, CnpjInfo } from '../types/validation.ts';
import { NfeCard } from './NfeCard.tsx';
import { formatCNPJ, formatCurrency } from '../utils/formatters.ts';
import { isNaoContribuinte } from '../engine/aliquota.ts';
import { TableProperties, LayoutGrid, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface NfeListViewProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}

const statusBadge: Record<string, string> = {
  OK: 'bg-success-100 text-success-700 border-success-200',
  ALERTA: 'bg-warning-100 text-warning-700 border-warning-200',
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
    filters.creditoPresumido.size > 0;

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
      return true;
    });
  }

  return true;
}

export function NfeListView({ results, filters, cnpjInfoMap }: NfeListViewProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const filtered = results
    .filter(v => matchesFilters(v, filters, cnpjInfoMap))
    .sort((a, b) => b.totalBC - a.totalBC);

  if (results.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText size={14} className="text-primary" />
          </div>
          Notas Fiscais
          {filtered.length !== results.length ? (
            <Badge variant="secondary" className="ml-1 text-[10px] font-mono">{filtered.length} de {results.length}</Badge>
          ) : (
            <Badge variant="secondary" className="ml-1 text-[10px] font-mono">{results.length}</Badge>
          )}
        </CardTitle>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setView('table'); setSelectedIdx(null); }}
            className="text-xs h-7"
          >
            <TableProperties size={13} />
            Tabela
          </Button>
          <Button
            variant={view === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setView('cards'); setSelectedIdx(null); }}
            className="text-xs h-7"
          >
            <LayoutGrid size={13} />
            Cards
          </Button>
        </div>
      </CardHeader>

      {view === 'table' && (
        <>
          <div className="overflow-hidden border-t border-border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto">NF</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto">Emitente</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto">Destinatario</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto">UF</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto text-right">Itens</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto text-right">BC ICMS</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto text-right">ICMS</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 h-auto text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v, idx) => (
                  <TableRow
                    key={idx}
                    onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                    className={cn(
                      'cursor-pointer',
                      idx % 2 === 0 ? 'bg-card' : 'bg-muted/50',
                      selectedIdx === idx && 'bg-primary-50 border-l-2 border-l-primary-500'
                    )}
                  >
                    <TableCell className="px-3 py-2 font-mono font-medium text-foreground">{v.nfe.numero}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="truncate max-w-[150px] text-foreground" title={v.nfe.emitNome}>
                        {v.nfe.emitCnpj ? formatCNPJ(v.nfe.emitCnpj) : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {(() => {
                        const info = v.nfe.dest.cnpj ? cnpjInfoMap?.get(v.nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
                        const isNC = isNaoContribuinte(v.nfe.dest);
                        const nome = info?.razaoSocial || v.nfe.dest.nome;
                        const cnaeText = info?.cnaeDescricao ? `${info.cnaePrincipal} - ${info.cnaeDescricao}` : '';
                        return (
                          <div className="flex flex-col">
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
                    <TableCell className="px-3 py-2 text-right text-muted-foreground">{v.itensValidados.length}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-foreground">{formatCurrency(v.totalBC)}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-foreground">{formatCurrency(v.totalICMSDestacado)}</TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <Badge className={cn('text-[10px]', statusBadge[v.statusFinal] ?? 'bg-muted text-muted-foreground border-border')}>
                        {v.statusFinal}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedIdx !== null && filtered[selectedIdx] && (
            <NfeCard validation={filtered[selectedIdx]} cnpjInfoMap={cnpjInfoMap} />
          )}
        </>
      )}

      {view === 'cards' && (
        <div className="px-6 pb-6 space-y-3">
          {filtered.map((r, idx) => (
            <NfeCard key={idx} validation={r} cnpjInfoMap={cnpjInfoMap} />
          ))}
        </div>
      )}
    </Card>
  );
}
