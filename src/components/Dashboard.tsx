import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, DollarSign, Receipt, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const CAMEX_CENARIOS = new Set(['A2', 'A5', 'A7', 'B2', 'B4-CAMEX', 'B5-CAMEX', 'B6-CAMEX']);

interface DashboardProps {
  results: NfeValidation[];
  /** Total de XMLs enviados no(s) upload(s) desta sessão */
  uploadedTotal?: number;
  discardedByCfop?: number;
  discardedZero?: number;
  /** Ignoradas por duplicidade (mesma chave NF-e já processada) */
  discardedDuplicates?: number;
  config: AppConfig;
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

const cenariosSemFundos = new Set(['B7', 'B9', 'B12', 'VEDADO', 'DEVOLUCAO', 'DESCONHECIDO']);

function buildGroups(results: NfeValidation[], config: AppConfig): {
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
      const isCamex = CAMEX_CENARIOS.has(cenarioId);
      const isAcoCobre = Math.abs(pICMS - 4) < 0.01 && isCobreAco(iv.item.ncm, config.listaCobreAco);
      const hasFundos = !cenariosSemFundos.has(cenarioId);
      const fundosVal = hasFundos ? iv.item.vBC * 0.004 : 0;

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

      const recolher = carga > 0 ? iv.item.vBC * (carga / 100) : 0;

      if (!acc[groupKey]) acc[groupKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga };
      acc[groupKey].itens++;
      acc[groupKey].bc += iv.item.vBC;
      acc[groupKey].icms += iv.item.vICMS;
      acc[groupKey].recolher += recolher;
      acc[groupKey].fundos += fundosVal;

      // CAMEX 2.1% alternative view
      if (isCamex && Math.abs(pICMS - 12) < 0.01) {
        const altKey = '12% CAMEX (2,1%)';
        const altCarga = 2.1;
        const altRecolher = iv.item.vBC * (altCarga / 100);
        if (!accCamex21[altKey]) accCamex21[altKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga: altCarga };
        accCamex21[altKey].itens++;
        accCamex21[altKey].bc += iv.item.vBC;
        accCamex21[altKey].icms += iv.item.vICMS;
        accCamex21[altKey].recolher += altRecolher;
        accCamex21[altKey].fundos += fundosVal;
      } else {
        if (!accCamex21[groupKey]) accCamex21[groupKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga };
        accCamex21[groupKey].itens++;
        accCamex21[groupKey].bc += iv.item.vBC;
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

export function Dashboard({ results, uploadedTotal = 0, discardedByCfop = 0, discardedZero = 0, discardedDuplicates = 0, config }: DashboardProps) {
  const totalUploaded = uploadedTotal > 0 ? uploadedTotal : results.length + discardedByCfop + discardedZero + discardedDuplicates;
  if (totalUploaded === 0) return null;

  const totalNfes = results.length;
  const nfesOk = results.filter(r => r.statusFinal === 'OK').length;
  const nfesAlerta = results.filter(r => r.statusFinal === 'ALERTA').length;
  const nfesErro = results.filter(r => r.statusFinal === 'ERRO').length;
  const totalBC = results.reduce((s, r) => s + r.totalBC, 0);
  const totalICMSDestacado = results.reduce((s, r) => s + r.totalICMSDestacado, 0);

  const { groups, camex21Groups, grandTotal36, grandTotal21 } = buildGroups(results, config);
  const hasCamex = groups.some(g => g.label === '12% CAMEX');

  return (
    <div className="mb-6 space-y-4">
      {/* Status summary bar */}
      <Card className="bg-gradient-to-r from-[#2B318A] to-[#5A81FA] border-0 shadow-lg">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Receipt size={20} className="text-white" />
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
                  <CheckCircle2 size={15} />
                  {nfesOk} OK
                </Badge>
                {nfesAlerta > 0 && (
                  <Badge className="bg-amber-400 text-amber-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                    <AlertTriangle size={15} />
                    {nfesAlerta} Alerta{nfesAlerta > 1 ? 's' : ''}
                  </Badge>
                )}
                {nfesErro > 0 && (
                  <Badge className="bg-red-400 text-red-950 border-0 font-semibold text-sm px-3 py-1 gap-1.5 shadow-sm">
                    <XCircle size={15} />
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
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <TotalCard label="Total BC ICMS" value={totalBC} icon={<TrendingUp size={18} />} />
        <TotalCard label="ICMS Destacado" value={totalICMSDestacado} icon={<DollarSign size={18} />} />
        <TotalCard label="ICMS Recolher (CAMEX 3,6%)" value={grandTotal36.icmsRecolher} accent="blue" icon={<Landmark size={18} />} />
        <TotalCard label="Total c/ Fundos (CAMEX 3,6%)" value={grandTotal36.total} accent="red" icon={<Receipt size={18} />} />
      </div>

      {/* Detail tables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Aliquota</CardTitle>
        </CardHeader>
        <CardContent>

        <h3 className="text-sm font-semibold text-foreground mb-2">
          {hasCamex ? 'CAMEX a 3,6%' : ''}
        </h3>
        <AliquotaTable groups={groups} grandTotal={grandTotal36} />

        {hasCamex && (
          <>
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-6">Detalhamento por Aliquota (CAMEX a 2,1%)</h3>
            <AliquotaTable groups={camex21Groups} grandTotal={grandTotal21} />
          </>
        )}

        {hasCamex && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-primary-200 hover:shadow-card-hover transition-shadow duration-200">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-primary mb-2">Total com CAMEX a 3,6%</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground mb-0.5">ICMS Recolher</div>
                    <div className="font-bold font-mono tabular-nums text-foreground">{formatCurrency(grandTotal36.icmsRecolher)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Fundos</div>
                    <div className="font-bold font-mono tabular-nums text-foreground">{formatCurrency(grandTotal36.fundos)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Total</div>
                    <div className="font-bold font-mono tabular-nums text-foreground">{formatCurrency(grandTotal36.total)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-card-hover transition-shadow duration-200">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-foreground mb-2">Total com CAMEX a 2,1%</div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground mb-0.5">ICMS Recolher</div>
                    <div className="font-bold font-mono tabular-nums text-foreground">{formatCurrency(grandTotal21.icmsRecolher)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Fundos</div>
                    <div className="font-bold font-mono tabular-nums text-foreground">{formatCurrency(grandTotal21.fundos)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-0.5">Total</div>
                    <div className="font-bold font-mono tabular-nums text-foreground">{formatCurrency(grandTotal21.total)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}

function AliquotaTable({ groups, grandTotal }: { groups: AliquotaGroup[]; grandTotal: { icmsRecolher: number; fundos: number; total: number } }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-[640px] text-xs">
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Grupo</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">BC ICMS</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">ICMS Dest.</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Carga %</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">ICMS Recolher</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fundos 0,4%</TableHead>
              <TableHead className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {groups.map((g, idx) => (
              <TableRow key={idx} className="hover:bg-muted/60 transition-colors duration-150">
                <TableCell className="px-4 py-2.5 font-medium text-foreground">{g.label}</TableCell>
                <TableCell className="px-4 py-2.5 text-right text-muted-foreground">{g.itens}</TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{formatCurrency(g.totalBC)}</TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{formatCurrency(g.totalICMSDestacado)}</TableCell>
                <TableCell className="px-4 py-2.5 text-right text-muted-foreground">{g.cargaPct > 0 ? `${g.cargaPct}%` : '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-primary">{formatCurrency(g.icmsRecolher)}</TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{formatCurrency(g.fundos)}</TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-foreground">{formatCurrency(g.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted font-semibold border-t-2 border-border">
              <TableCell className="px-4 py-2.5 text-foreground" colSpan={5}>Total</TableCell>
              <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-primary">{formatCurrency(grandTotal.icmsRecolher)}</TableCell>
              <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{formatCurrency(grandTotal.fundos)}</TableCell>
              <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{formatCurrency(grandTotal.total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Card>
  );
}

function TotalCard({ label, value, accent, icon, className = '' }: { label: string; value: number; accent?: string; icon?: React.ReactNode; className?: string }) {
  const accentStyles: Record<string, { bg: string; iconBg: string; iconColor: string; valueColor: string }> = {
    blue: { bg: 'bg-primary-50 border-primary-200/60', iconBg: 'bg-primary/10', iconColor: 'text-primary', valueColor: 'text-primary' },
    red: { bg: 'bg-danger-50 border-danger-200/60', iconBg: 'bg-danger-500/10', iconColor: 'text-danger-600', valueColor: 'text-danger-700' },
  };
  const style = accent ? accentStyles[accent] : undefined;

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-200 hover:shadow-md',
      style?.bg,
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
            <p className={cn('text-lg font-bold font-mono tabular-nums mt-1.5', style?.valueColor ?? 'text-foreground')}>{formatCurrency(value)}</p>
          </div>
          {icon && (
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', style?.iconBg ?? 'bg-muted')}>
              <span className={style?.iconColor ?? 'text-muted-foreground'}>{icon}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
