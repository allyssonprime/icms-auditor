import { useMemo } from 'react';
import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { getCenarios } from '../engine/cenarios.ts';
import { buildDashboardGroups, type AliquotaGroup } from './dashboardGroups.ts';
import { CheckCircle2, AlertTriangle, XCircle, Receipt, AlertCircle, Info, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';


interface DashboardProps {
  results: NfeValidation[];
  /** Total de XMLs enviados no(s) upload(s) desta sessão */
  uploadedTotal?: number;
  discardedByCfop?: number;
  discardedZero?: number;
  /** Ignoradas por duplicidade (mesma chave NF-e já processada) */
  discardedDuplicates?: number;
  config: AppConfig;
  regras: RegrasConfig;
}

export function Dashboard({ results, uploadedTotal = 0, discardedByCfop = 0, discardedZero = 0, discardedDuplicates = 0, config, regras }: DashboardProps) {
  const cenariosMap = useMemo(() => getCenarios(regras), [regras]);
  const totalUploaded = uploadedTotal > 0 ? uploadedTotal : results.length + discardedByCfop + discardedZero + discardedDuplicates;
  if (totalUploaded === 0) return null;

  const totalNfes = results.length;
  const nfesOk = results.filter(r => r.statusFinal === 'OK').length;
  const nfesInfo = results.filter(r => r.statusFinal === 'INFO').length;
  const nfesAviso = results.filter(r => r.statusFinal === 'AVISO').length;
  const nfesDivergencia = results.filter(r => r.statusFinal === 'DIVERGENCIA').length;
  const nfesErro = results.filter(r => r.statusFinal === 'ERRO').length;
  const totalBC = results.reduce((s, r) => s + r.totalBC, 0);
  const totalICMSDestacado = results.reduce((s, r) => s + r.totalICMSDestacado, 0);
  const totalItens = results.reduce((s, r) => s + r.itensValidados.length, 0);

  const { groups, grandTotal } = buildDashboardGroups(results, config, cenariosMap);

  // Build real alerts from validation data
  const alerts: { severity: 'erro' | 'divergencia' | 'aviso'; message: string }[] = [];
  if (nfesErro > 0) alerts.push({ severity: 'erro', message: `${nfesErro} NF-e com erros de validacao que requerem atencao imediata` });
  if (nfesDivergencia > 0) alerts.push({ severity: 'divergencia', message: `${nfesDivergencia} NF-e com divergencias identificadas entre valores destacados e esperados` });
  // Check for BC inconsistencies
  const bcInconsistent = results.reduce((s, r) => s + r.itensValidados.filter(iv => !iv.bcConsistente).length, 0);
  if (bcInconsistent > 0) alerts.push({ severity: 'aviso', message: `${bcInconsistent} itens com BC ICMS inconsistente (base de calculo diverge do esperado)` });

  const effectiveRate = totalBC > 0 ? (grandTotal.icmsRecolher / totalBC) * 100 : 0;

  return (
    <div className="mb-4 space-y-2.5">
      {/* Status summary bar */}
      <Card className="bg-[color:var(--prime-navy)] border-0 shadow-lg">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Receipt size={20} className="text-white" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {totalUploaded} NF-e no upload
                </h2>
                <p className="text-sm text-white/90 mt-0.5">
                  {totalNfes} processada{totalNfes !== 1 ? 's' : ''} &middot; {discardedByCfop} descartada{discardedByCfop !== 1 ? 's' : ''} por CFOP &middot; {discardedZero} zerada{discardedZero !== 1 ? 's' : ''} descartada{discardedZero !== 1 ? 's' : ''}
                  {discardedDuplicates > 0 && <> &middot; {discardedDuplicates} duplicada{discardedDuplicates !== 1 ? 's' : ''} ignorada{discardedDuplicates !== 1 ? 's' : ''}</>}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {totalNfes > 0 && (
        <>
      {/* Status distribution — StatCard row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <StatCard
          icon={<CheckCircle2 size={20} aria-hidden />}
          tone="success"
          value={nfesOk}
          label="OK"
        />
        <StatCard
          icon={<Info size={20} aria-hidden />}
          tone="blue"
          value={nfesInfo}
          label="Info"
        />
        <StatCard
          icon={<AlertCircle size={20} aria-hidden />}
          tone="gold"
          value={nfesAviso}
          label={`Aviso${nfesAviso !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<AlertTriangle size={20} aria-hidden />}
          tone="orange"
          value={nfesDivergencia}
          label="Divergências"
        />
        <StatCard
          icon={<XCircle size={20} aria-hidden />}
          tone="danger"
          value={nfesErro}
          label={`Erro${nfesErro !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Metric cards with context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <TotalCard label="Total BC ICMS" value={totalBC} subtitle={`${totalItens} itens em ${totalNfes} NF-e`} showCorner />
        <TotalCard label="ICMS Destacado" value={totalICMSDestacado} subtitle={totalBC > 0 ? `${((totalICMSDestacado / totalBC) * 100).toFixed(1)}% da BC` : undefined} />
        <TotalCard label="ICMS Recolher" value={grandTotal.icmsRecolher} accent="blue" subtitle={`Carga efetiva ${effectiveRate.toFixed(2)}%`} />
        <TotalCard label="Total c/ Fundos" value={grandTotal.total} accent="red" subtitle={`Fundos: ${formatCurrency(grandTotal.fundos)}`} />
      </div>

      {/* Real alerts from validation */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm',
              alert.severity === 'erro' && 'bg-danger-100 text-danger-700',
              alert.severity === 'divergencia' && 'bg-orange-100 text-orange-700',
              alert.severity === 'aviso' && 'bg-warning-100 text-warning-700',
            )} role="alert">
              {alert.severity === 'erro' ? <XCircle size={16} aria-hidden /> :
               alert.severity === 'divergencia' ? <AlertTriangle size={16} aria-hidden /> :
               <AlertCircle size={16} aria-hidden />}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Single unified aliquota table */}
      <AliquotaTable groups={groups} grandTotal={grandTotal} />

        </>
      )}
    </div>
  );
}

function getAliquotaBadgeClass(label: string): string {
  if (label.startsWith('4%')) return 'bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold tabular-nums';
  if (label.startsWith('10%')) return 'bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold tabular-nums';
  if (label.startsWith('12%')) return 'bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold tabular-nums';
  if (label.startsWith('17%')) return 'bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold tabular-nums';
  return 'bg-surface-container text-foreground px-2 py-1 rounded text-xs font-bold tabular-nums';
}

function AliquotaTable({ groups, grandTotal }: {
  groups: AliquotaGroup[];
  grandTotal: { icmsRecolher: number; fundos: number; total: number };
}) {
  return (
    <div className="bg-surface-lowest rounded-xl shadow-[0_12px_32px_-4px_rgba(19,27,46,0.08)] overflow-hidden">
      {/* Compact header */}
      <div className="px-4 py-2.5 flex items-center gap-2 bg-surface-container-low">
        <BarChart3 size={14} className="text-primary" aria-hidden />
        <span className="font-semibold text-sm text-foreground">Detalhamento por Aliquota</span>
        <Badge variant="secondary" className="ml-auto text-[10px] font-mono">{groups.length} grupos</Badge>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[640px] text-xs">
          <TableHeader>
            <TableRow className="bg-white border-b border-[var(--outline-variant)]/20">
              <TableHead className="text-left px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">Grupo</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">Itens</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">BC ICMS</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">ICMS Dest.</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">Carga %</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">ICMS Recolher</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">Fundos 0,4%</TableHead>
              <TableHead className="text-right px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g, idx) => (
              <TableRow key={idx} className="h-8 hover:bg-primary/5 transition-colors border-b border-slate-50">
                <TableCell className="px-4 py-1.5">
                  <span className={getAliquotaBadgeClass(g.label)}>{g.label}</span>
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right text-muted-foreground tabular-nums">{g.itens}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums">{formatCurrency(g.totalBC)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums">{formatCurrency(g.totalICMSDestacado)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right">
                  {g.cargaPct > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-surface-container text-secondary text-[11px] font-bold rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {g.cargaPct}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-primary">{formatCurrency(g.icmsRecolher)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums">{formatCurrency(g.fundos)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums font-semibold">{formatCurrency(g.total)}</TableCell>
              </TableRow>
            ))}

          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted font-semibold border-t-2 border-border">
              <TableCell className="px-4 py-2 text-foreground" colSpan={5}>
                Total
              </TableCell>
              <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-primary">{formatCurrency(grandTotal.icmsRecolher)}</TableCell>
              <TableCell className="px-4 py-2 text-right font-mono tabular-nums">{formatCurrency(grandTotal.fundos)}</TableCell>
              <TableCell className="px-4 py-2 text-right font-mono tabular-nums">{formatCurrency(grandTotal.total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

function TotalCard({ label, value, accent, subtitle, className = '', showCorner = false }: { label: string; value: number; accent?: string; subtitle?: string; className?: string; showCorner?: boolean }) {
  const accentStyles: Record<string, { valueColor: string }> = {
    blue: { valueColor: 'text-primary' },
    red: { valueColor: 'text-danger-700' },
  };
  const style = accent ? accentStyles[accent] : undefined;

  const formatted = formatCurrency(value);
  const prefix = formatted.startsWith('R$') ? 'R$ ' : '';
  const numericPart = formatted.startsWith('R$') ? formatted.slice(2).trim() : formatted;

  return (
    <div className={cn(
      'bg-surface-lowest p-3.5 rounded-[10px] shadow-sm border border-[rgba(196,197,214,0.1)] relative overflow-hidden group',
      className
    )}>
      {showCorner && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8" />
      )}
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums text-foreground tracking-tight mt-1.5', style?.valueColor ?? 'text-foreground')}>
        <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
        {numericPart}
      </p>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
