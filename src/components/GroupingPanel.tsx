import { useMemo } from 'react';
import type { NfeValidation, ActiveFilters, GroupedData, CnpjInfo } from '../types/validation.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { FilterX, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface GroupingPanelProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  onToggleFilter: (type: keyof ActiveFilters, value: string | number) => void;
  onClearFilters: () => void;
  onQuickGroup: (type: keyof ActiveFilters, values: Array<string | number>) => void;
  onSearchChange: (text: string) => void;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}

function buildGroups(
  results: NfeValidation[],
  groupBy: 'aliquota' | 'cst' | 'cfop' | 'cenario',
): GroupedData[] {
  const map = new Map<string, { count: number; totalBC: number; totalICMS: number }>();

  for (const r of results) {
    for (const iv of r.itensValidados) {
      let key: string;
      if (groupBy === 'aliquota') key = `${iv.item.pICMS}%`;
      else if (groupBy === 'cst') key = iv.item.cst;
      else if (groupBy === 'cfop') key = iv.item.cfop;
      else key = iv.cenario;

      const existing = map.get(key) ?? { count: 0, totalBC: 0, totalICMS: 0 };
      existing.count += 1;
      existing.totalBC += iv.item.vBC;
      existing.totalICMS += iv.item.vICMS;
      map.set(key, existing);
    }
  }

  return Array.from(map.entries())
    .map(([label, data]) => ({ label, ...data }))
    .sort((a, b) => b.totalBC - a.totalBC);
}

function buildDimensionGroups(
  results: NfeValidation[],
  dimension: 'vedado' | 'creditoPresumido' | 'tipoOperacao',
): GroupedData[] {
  const map = new Map<string, { count: number; totalBC: number; totalICMS: number }>();

  for (const r of results) {
    for (const iv of r.itensValidados) {
      let key: string;
      if (dimension === 'vedado') {
        key = iv.cenario === 'VEDADO' ? 'Sim' : 'Nao';
      } else if (dimension === 'creditoPresumido') {
        key = iv.item.cCredPresumido ? `CP ${iv.item.cCredPresumido}` : 'Sem CP';
      } else {
        key = r.nfe.dest.uf.toUpperCase() === 'SC' ? 'Interna' : 'Interestadual';
      }

      const existing = map.get(key) ?? { count: 0, totalBC: 0, totalICMS: 0 };
      existing.count += 1;
      existing.totalBC += iv.item.vBC;
      existing.totalICMS += iv.item.vICMS;
      map.set(key, existing);
    }
  }

  return Array.from(map.entries())
    .map(([label, data]) => ({ label, ...data }))
    .sort((a, b) => b.totalBC - a.totalBC);
}

export function GroupingPanel({
  results,
  filters,
  onToggleFilter,
  onClearFilters,
  onQuickGroup,
  onSearchChange,
}: GroupingPanelProps) {
  const byAliquota = useMemo(() => buildGroups(results, 'aliquota'), [results]);
  const byCst = useMemo(() => buildGroups(results, 'cst'), [results]);
  const byCfop = useMemo(() => buildGroups(results, 'cfop'), [results]);
  const byCenario = useMemo(() => buildGroups(results, 'cenario'), [results]);
  const byVedado = useMemo(() => buildDimensionGroups(results, 'vedado'), [results]);
  const byCreditoPresumido = useMemo(() => buildDimensionGroups(results, 'creditoPresumido'), [results]);
  const byTipoOperacao = useMemo(() => buildDimensionGroups(results, 'tipoOperacao'), [results]);

  // Dynamic aliquota quick buttons from actual data
  const aliquotaValues = useMemo(() => {
    const set = new Set<number>();
    for (const r of results) {
      for (const iv of r.itensValidados) {
        set.add(iv.item.pICMS);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [results]);

  const hasFilters =
    filters.aliquota.size > 0 ||
    filters.cst.size > 0 ||
    filters.cfop.size > 0 ||
    filters.cenario.size > 0 ||
    filters.status.size > 0 ||
    filters.vedado.size > 0 ||
    filters.creditoPresumido.size > 0 ||
    filters.tipoOperacao.size > 0 ||
    filters.searchText.length > 0;

  if (results.length === 0) return null;

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Search size={14} className="text-primary" />
          </div>
          Agrupamentos e Filtros
        </CardTitle>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-destructive hover:text-destructive hover:bg-danger-50"
          >
            <FilterX size={14} />
            Limpar filtros
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Search input */}
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por CNPJ, IE, razao social, numero ou NCM..."
            value={filters.searchText}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Quick groups */}
        <div className="flex flex-wrap gap-2 mb-5 bg-muted/50 rounded-lg p-3">
          <span className="text-xs text-muted-foreground self-center mr-1 font-medium">Filtros rapidos:</span>
          {aliquotaValues.map(aliq => (
            <QuickButton
              key={`aliq-${aliq}`}
              label={`${aliq}%`}
              onClick={() => onQuickGroup('aliquota', [aliq])}
              active={filters.aliquota.has(aliq) && filters.aliquota.size === 1}
            />
          ))}
          <span className="text-border">|</span>
          <QuickButton
            label="Somente Erros"
            onClick={() => onQuickGroup('status', ['ERRO'])}
            active={filters.status.has('ERRO') && filters.status.size === 1}
          />
          <QuickButton
            label="Alertas"
            onClick={() => onQuickGroup('status', ['ALERTA'])}
            active={filters.status.has('ALERTA') && filters.status.size === 1}
          />
          <span className="text-border">|</span>
          <QuickButton
            label="Vedados"
            onClick={() => onQuickGroup('vedado', ['Sim'])}
            active={filters.vedado.has('Sim') && filters.vedado.size === 1}
          />
          <QuickButton
            label="Internas"
            onClick={() => onQuickGroup('tipoOperacao', ['Interna'])}
            active={filters.tipoOperacao.has('Interna') && filters.tipoOperacao.size === 1}
          />
          <QuickButton
            label="Interestaduais"
            onClick={() => onQuickGroup('tipoOperacao', ['Interestadual'])}
            active={filters.tipoOperacao.has('Interestadual') && filters.tipoOperacao.size === 1}
          />
        </div>

        {/* Group tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GroupTable
            title="Por Aliquota"
            groups={byAliquota}
            activeSet={filters.aliquota}
            getKey={(g) => parseFloat(g.label)}
            onToggle={(v) => onToggleFilter('aliquota', v)}
          />
          <GroupTable
            title="Por CST"
            groups={byCst}
            activeSet={filters.cst}
            getKey={(g) => g.label}
            onToggle={(v) => onToggleFilter('cst', v)}
          />
          <GroupTable
            title="Por CFOP"
            groups={byCfop}
            activeSet={filters.cfop}
            getKey={(g) => g.label}
            onToggle={(v) => onToggleFilter('cfop', v)}
          />
          <GroupTable
            title="Por Cenario"
            groups={byCenario}
            activeSet={filters.cenario}
            getKey={(g) => g.label}
            onToggle={(v) => onToggleFilter('cenario', v)}
          />
          <GroupTable
            title="Vedados"
            groups={byVedado}
            activeSet={filters.vedado}
            getKey={(g) => g.label}
            onToggle={(v) => onToggleFilter('vedado', v)}
          />
          <GroupTable
            title="Credito Presumido"
            groups={byCreditoPresumido}
            activeSet={filters.creditoPresumido}
            getKey={(g) => g.label}
            onToggle={(v) => onToggleFilter('creditoPresumido', v)}
          />
          <GroupTable
            title="Tipo Operacao"
            groups={byTipoOperacao}
            activeSet={filters.tipoOperacao}
            getKey={(g) => g.label}
            onToggle={(v) => onToggleFilter('tipoOperacao', v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickButton({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="text-xs"
    >
      {label}
    </Button>
  );
}

function GroupTable<T extends string | number>({
  title,
  groups,
  activeSet,
  getKey,
  onToggle,
}: {
  title: string;
  groups: GroupedData[];
  activeSet: Set<T>;
  getKey: (g: GroupedData) => T;
  onToggle: (value: T) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="border border-border rounded-lg overflow-hidden shadow-xs">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Itens</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">BC ICMS</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ICMS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const key = getKey(g);
              const isActive = activeSet.has(key);
              return (
                <TableRow
                  key={g.label}
                  onClick={() => onToggle(key)}
                  className={cn(
                    'cursor-pointer transition-all duration-150',
                    isActive
                      ? 'bg-primary-50 border-l-[3px] border-l-primary shadow-sm'
                      : 'hover:bg-muted/60'
                  )}
                >
                  <TableCell className={cn('px-3 py-2 font-mono font-medium', isActive && 'text-primary-700')}>{g.label}</TableCell>
                  <TableCell className="px-3 py-2 text-right text-muted-foreground">{g.count}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(g.totalBC)}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(g.totalICMS)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
