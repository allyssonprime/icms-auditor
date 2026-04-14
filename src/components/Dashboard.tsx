import { useMemo } from 'react';
import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { RegrasConfig } from '../types/regras.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import { formatCurrency, bcIntegral } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { getCenarios } from '../engine/cenarios.ts';
import { CheckCircle2, AlertTriangle, XCircle, Receipt, AlertCircle, Info, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface AliquotaGroup {
  label: string;
  itens: number;
  totalBC: number;
  totalICMSDestacado: number;
  cargaPct: number;
  icmsRecolher: number;
  fundos: number;
  total: number;
}

function buildGroups(results: NfeValidation[], config: AppConfig, cenariosMap: Record<string, CenarioConfig>): {
  groups: AliquotaGroup[];
  camex21Groups: AliquotaGroup[];
  grandTotal36: { icmsRecolher: number; fundos: number; total: number };
  grandTotal21: { icmsRecolher: number; fundos: number; total: number };
} {
  const acc: Record<string, { itens: number; bc: number; icms: number; recolher: number; fundos: number; carga: number }> = {};
  const accCamex21: Record<string, { itens: number; bc: number; icms: number; recolher: number; fundos: number; carga: number }> = {};

  for (const nv of results) {
    for (const iv of nv.itensValidados) {
      const pICMS = iv.item.pICMS;
      const cenarioId = iv.cenario;
      const isCamex = cenariosMap[cenarioId]?.isCAMEX ?? false;
      const isAcoCobre = Math.abs(pICMS - 4) < 0.01 && isCobreAco(iv.item.ncm, config.listaCobreAco);
      const cenarioConfig = cenariosMap[cenarioId];
      const fundosPct = cenarioConfig?.fundos ?? 0;
      const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      const fundosVal = fundosPct > 0 ? bc * (fundosPct / 100) : 0;

      let groupKey: string;
      let carga: number;

      if (Math.abs(pICMS - 4) < 0.01) {
        if (isAcoCobre) { groupKey = '4% Aço/Cobre'; carga = 0.6; }
        else { groupKey = '4%'; carga = 1.0; }
      } else if (Math.abs(pICMS - 10) < 0.01) {
        groupKey = '10%'; carga = 3.6;
      } else if (Math.abs(pICMS - 12) < 0.01) {
        groupKey = isCamex ? '12% CAMEX' : '12%'; carga = 3.6;
      } else if (Math.abs(pICMS - 17) < 0.01) {
        groupKey = '17%'; carga = 3.6;
      } else if (Math.abs(pICMS - 7) < 0.01) {
        groupKey = '7%'; carga = 3.6;
      } else if (Math.abs(pICMS - 25) < 0.01) {
        groupKey = '25%'; carga = 3.6;
      } else if (pICMS === 0) {
        groupKey = '0% (Diferimento/Transf.)'; carga = 0;
      } else {
        groupKey = `${pICMS}%`; carga = 3.6;
      }

      const recolher = carga > 0 ? bc * (carga / 100) : 0;

      if (!acc[groupKey]) acc[groupKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga };
      acc[groupKey].itens++;
      acc[groupKey].bc += bc;
      acc[groupKey].icms += iv.item.vICMS;
      acc[groupKey].recolher += recolher;
      acc[groupKey].fundos += fundosVal;

      // CAMEX 2.1% alternative view
      if (isCamex && Math.abs(pICMS - 12) < 0.01) {
        const altKey = '12% CAMEX (2,1%)';
        const altCarga = 2.1;
        const altRecolher = bc * (altCarga / 100);
        if (!accCamex21[altKey]) accCamex21[altKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga: altCarga };
        accCamex21[altKey].itens++;
        accCamex21[altKey].bc += bc;
        accCamex21[altKey].icms += iv.item.vICMS;
        accCamex21[altKey].recolher += altRecolher;
        accCamex21[altKey].fundos += fundosVal;
      } else {
        if (!accCamex21[groupKey]) accCamex21[groupKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga };
        accCamex21[groupKey].itens++;
        accCamex21[groupKey].bc += bc;
        accCamex21[groupKey].icms += iv.item.vICMS;
        accCamex21[groupKey].recolher += recolher;
        accCamex21[groupKey].fundos += fundosVal;
      }
    }
  }

  const sortOrder = ['4% Aço/Cobre', '4%', '7%', '10%', '12% CAMEX', '12% CAMEX (2,1%)', '12%', '17%', '25%'];

  function toGroups(map: Record<string, { itens: number; bc: number; icms: number; recolher: number; fundos: number; carga: number }>): AliquotaGroup[] {
    return Object.entries(map)
      .sort(([a], [b]) => {
        const ia = sortOrder.indexOf(a);
        const ib = sortOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
      .map(([label, v]) => ({
        label, itens: v.itens, totalBC: v.bc, totalICMSDestacado: v.icms,
        cargaPct: v.carga, icmsRecolher: v.recolher, fundos: v.fundos, total: v.recolher + v.fundos,
      }));
  }

  const groups = toGroups(acc);
  const camex21Groups = toGroups(accCamex21);
  const sum = (gs: AliquotaGroup[]) => ({
    icmsRecolher: gs.reduce((s, g) => s + g.icmsRecolher, 0),
    fundos: gs.reduce((s, g) => s + g.fundos, 0),
    total: gs.reduce((s, g) => s + g.total, 0),
  });

  return { groups, camex21Groups, grandTotal36: sum(groups), grandTotal21: sum(camex21Groups) };
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

  const { groups, camex21Groups, grandTotal36, grandTotal21 } = buildGroups(results, config, cenariosMap);
  const hasCamex = groups.some(g => g.label === '12% CAMEX');

  // Build real alerts from validation data
  const alerts: { severity: 'erro' | 'divergencia' | 'aviso'; message: string }[] = [];
  if (nfesErro > 0) alerts.push({ severity: 'erro', message: `${nfesErro} NF-e com erros de validacao que requerem atencao imediata` });
  if (nfesDivergencia > 0) alerts.push({ severity: 'divergencia', message: `${nfesDivergencia} NF-e com divergencias identificadas entre valores destacados e esperados` });
  // Check for BC inconsistencies
  const bcInconsistent = results.reduce((s, r) => s + r.itensValidados.filter(iv => !iv.bcConsistente).length, 0);
  if (bcInconsistent > 0) alerts.push({ severity: 'aviso', message: `${bcInconsistent} itens com BC ICMS inconsistente (base de calculo diverge do esperado)` });

  const effectiveRate = totalBC > 0 ? (grandTotal36.icmsRecolher / totalBC) * 100 : 0;

  return (
    <div className="mb-4 space-y-2.5">
      {/* Status summary bar */}
      <Card className="bg-gradient-to-r from-[#2B318A] to-[#5A81FA] border-0 shadow-lg">
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
            {totalNfes > 0 && (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-400 text-emerald-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                  <CheckCircle2 size={15} aria-hidden />
                  {nfesOk} OK
                </Badge>
                {nfesInfo > 0 && (
                  <Badge className="bg-sky-400 text-sky-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                    <Info size={15} aria-hidden />
                    {nfesInfo} Info
                  </Badge>
                )}
                {nfesAviso > 0 && (
                  <Badge className="bg-amber-400 text-amber-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                    <AlertCircle size={15} aria-hidden />
                    {nfesAviso} Aviso{nfesAviso > 1 ? 's' : ''}
                  </Badge>
                )}
                {nfesDivergencia > 0 && (
                  <Badge className="bg-orange-400 text-orange-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                    <AlertTriangle size={15} aria-hidden />
                    {nfesDivergencia} Diverg.
                  </Badge>
                )}
                {nfesErro > 0 && (
                  <Badge className="bg-red-400 text-red-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                    <XCircle size={15} aria-hidden />
                    {nfesErro} Erro{nfesErro > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {totalNfes > 0 && (
        <>
      {/* Metric cards with context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <TotalCard label="Total BC ICMS" value={totalBC} subtitle={`${totalItens} itens em ${totalNfes} NF-e`} showCorner />
        <TotalCard label="ICMS Destacado" value={totalICMSDestacado} subtitle={totalBC > 0 ? `${((totalICMSDestacado / totalBC) * 100).toFixed(1)}% da BC` : undefined} />
        <TotalCard label="ICMS Recolher (CAMEX 3,6%)" value={grandTotal36.icmsRecolher} accent="blue" subtitle={`Carga efetiva ${effectiveRate.toFixed(2)}%`} />
        <TotalCard label="Total c/ Fundos (CAMEX 3,6%)" value={grandTotal36.total} accent="red" subtitle={`Fundos: ${formatCurrency(grandTotal36.fundos)}`} />
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
      <AliquotaTable groups={groups} grandTotal={grandTotal36} camex21Groups={hasCamex ? camex21Groups : undefined} grandTotal21={hasCamex ? grandTotal21 : undefined} />

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

function AliquotaTable({ groups, grandTotal, camex21Groups, grandTotal21 }: {
  groups: AliquotaGroup[];
  grandTotal: { icmsRecolher: number; fundos: number; total: number };
  camex21Groups?: AliquotaGroup[];
  grandTotal21?: { icmsRecolher: number; fundos: number; total: number };
}) {
  const hasCamex = !!camex21Groups && !!grandTotal21;
  // Find the CAMEX 2.1% alternative row to show inline
  const camex21Row = camex21Groups?.find(g => g.label.includes('2,1%'));
  const diffRecolher = hasCamex ? grandTotal.icmsRecolher - grandTotal21!.icmsRecolher : 0;

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

            {/* CAMEX 2.1% alternative row - inline, visually distinct */}
            {hasCamex && camex21Row && (
              <TableRow className="h-8 bg-purple-50/30 border-b border-purple-100/50">
                <TableCell className="px-4 py-1.5">
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold tabular-nums">
                    &nbsp;&nbsp;&#x21B3; se CAMEX a 2,1%
                  </span>
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right text-muted-foreground tabular-nums">{camex21Row.itens}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(camex21Row.totalBC)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(camex21Row.totalICMSDestacado)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right">
                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[11px] font-bold rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {camex21Row.cargaPct}%
                  </span>
                </TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-purple-700">{formatCurrency(camex21Row.icmsRecolher)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(camex21Row.fundos)}</TableCell>
                <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums font-semibold text-purple-700">{formatCurrency(camex21Row.total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted font-semibold border-t-2 border-border">
              <TableCell className="px-4 py-2 text-foreground" colSpan={5}>
                Total {hasCamex && <span className="font-normal text-muted-foreground text-[10px] ml-1">(CAMEX 3,6%)</span>}
              </TableCell>
              <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-primary">{formatCurrency(grandTotal.icmsRecolher)}</TableCell>
              <TableCell className="px-4 py-2 text-right font-mono tabular-nums">{formatCurrency(grandTotal.fundos)}</TableCell>
              <TableCell className="px-4 py-2 text-right font-mono tabular-nums">{formatCurrency(grandTotal.total)}</TableCell>
            </TableRow>
            {hasCamex && grandTotal21 && (
              <>
                <TableRow className="bg-purple-50/40 font-semibold border-t border-purple-100">
                  <TableCell className="px-4 py-2 text-purple-700" colSpan={5}>
                    Total <span className="text-[10px] ml-1">(CAMEX 2,1%)</span>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-purple-700">{formatCurrency(grandTotal21.icmsRecolher)}</TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-purple-700">{formatCurrency(grandTotal21.fundos)}</TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono tabular-nums text-purple-700">{formatCurrency(grandTotal21.total)}</TableCell>
                </TableRow>
                <TableRow className="bg-slate-50 text-[10px]">
                  <TableCell className="px-4 py-1.5 text-muted-foreground" colSpan={5}>
                    Diferenca (3,6% &minus; 2,1%)
                  </TableCell>
                  <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-foreground font-semibold">{formatCurrency(diffRecolher)}</TableCell>
                  <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">&mdash;</TableCell>
                  <TableCell className="px-4 py-1.5 text-right font-mono tabular-nums text-foreground font-semibold">{formatCurrency(grandTotal.total - grandTotal21.total)}</TableCell>
                </TableRow>
              </>
            )}
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
