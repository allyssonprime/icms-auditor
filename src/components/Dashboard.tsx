import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';

const CAMEX_CENARIOS = new Set(['A2', 'A5', 'A7', 'B2', 'B4-CAMEX', 'B5-CAMEX', 'B6-CAMEX']);

interface DashboardProps {
  results: NfeValidation[];
  discardedByCfop?: number;
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

export function Dashboard({ results, discardedByCfop = 0, config }: DashboardProps) {
  if (results.length === 0) return null;

  const totalNfes = results.length;
  const nfesOk = results.filter(r => r.statusFinal === 'OK').length;
  const nfesAlerta = results.filter(r => r.statusFinal === 'ALERTA').length;
  const nfesErro = results.filter(r => r.statusFinal === 'ERRO').length;
  const totalBC = results.reduce((s, r) => s + r.totalBC, 0);
  const totalICMSDestacado = results.reduce((s, r) => s + r.totalICMSDestacado, 0);

  const { groups, camex21Groups, grandTotal36, grandTotal21 } = buildGroups(results, config);
  const hasCamex = groups.some(g => g.label === '12% CAMEX');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumo</h2>

      <div className="flex flex-wrap gap-6 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-green-500 inline-block" />
          <span className="text-2xl font-bold text-green-700">{nfesOk}</span>
          <span className="text-sm text-gray-500">OK</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-yellow-400 inline-block" />
          <span className="text-2xl font-bold text-yellow-600">{nfesAlerta}</span>
          <span className="text-sm text-gray-500">Alertas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-red-500 inline-block" />
          <span className="text-2xl font-bold text-red-700">{nfesErro}</span>
          <span className="text-sm text-gray-500">Erros</span>
        </div>
        <div className="text-sm text-gray-500 self-center">
          {totalNfes} NF-e processadas
          {discardedByCfop > 0 && (
            <span className="ml-2 text-gray-400">
              ({discardedByCfop} descartada{discardedByCfop > 1 ? 's' : ''} por CFOP/valor)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 mb-6">
        <TotalCard label="Total BC ICMS" value={totalBC} />
        <TotalCard label="ICMS Destacado" value={totalICMSDestacado} />
        <TotalCard label="ICMS Recolher (CAMEX 3,6%)" value={grandTotal36.icmsRecolher} accent="blue" />
        <TotalCard label="Total c/ Fundos (CAMEX 3,6%)" value={grandTotal36.total} accent="red" />
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mb-2 mt-6">
        Detalhamento por Alíquota{hasCamex ? ' (CAMEX a 3,6%)' : ''}
      </h3>
      <AliquotaTable groups={groups} grandTotal={grandTotal36} />

      {hasCamex && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 mt-6">Detalhamento por Alíquota (CAMEX a 2,1%)</h3>
          <AliquotaTable groups={camex21Groups} grandTotal={grandTotal21} />
        </>
      )}

      {hasCamex && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-medium text-blue-600 mb-1">Total com CAMEX a 3,6%</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-blue-500">ICMS Recolher</div><div className="font-bold text-blue-800">{formatCurrency(grandTotal36.icmsRecolher)}</div></div>
              <div><div className="text-blue-500">Fundos</div><div className="font-bold text-blue-800">{formatCurrency(grandTotal36.fundos)}</div></div>
              <div><div className="text-blue-500">Total</div><div className="font-bold text-blue-800">{formatCurrency(grandTotal36.total)}</div></div>
            </div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="text-xs font-medium text-purple-600 mb-1">Total com CAMEX a 2,1%</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-purple-500">ICMS Recolher</div><div className="font-bold text-purple-800">{formatCurrency(grandTotal21.icmsRecolher)}</div></div>
              <div><div className="text-purple-500">Fundos</div><div className="font-bold text-purple-800">{formatCurrency(grandTotal21.fundos)}</div></div>
              <div><div className="text-purple-500">Total</div><div className="font-bold text-purple-800">{formatCurrency(grandTotal21.total)}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AliquotaTable({ groups, grandTotal }: { groups: AliquotaGroup[]; grandTotal: { icmsRecolher: number; fundos: number; total: number } }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-3 py-2 font-medium text-gray-600">Grupo</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">Itens</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">BC ICMS</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">ICMS Dest.</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">Carga %</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">ICMS Recolher</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">Fundos 0,4%</th>
            <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, idx) => (
            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-800">{g.label}</td>
              <td className="px-3 py-2 text-right text-gray-700">{g.itens}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-700">{formatCurrency(g.totalBC)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-700">{formatCurrency(g.totalICMSDestacado)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{g.cargaPct > 0 ? `${g.cargaPct}%` : '-'}</td>
              <td className="px-3 py-2 text-right font-mono text-blue-700">{formatCurrency(g.icmsRecolher)}</td>
              <td className="px-3 py-2 text-right font-mono text-purple-700">{formatCurrency(g.fundos)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">{formatCurrency(g.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
            <td className="px-3 py-2 text-gray-800" colSpan={5}>Total</td>
            <td className="px-3 py-2 text-right font-mono text-blue-800">{formatCurrency(grandTotal.icmsRecolher)}</td>
            <td className="px-3 py-2 text-right font-mono text-purple-800">{formatCurrency(grandTotal.fundos)}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-900">{formatCurrency(grandTotal.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TotalCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    purple: 'text-purple-700 bg-purple-50 border-purple-200',
    red: 'text-red-700 bg-red-50 border-red-200',
  };
  const cls = accent ? colors[accent] ?? 'text-gray-700 bg-gray-50 border-gray-200' : 'text-gray-700 bg-gray-50 border-gray-200';

  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-sm font-bold mt-1">{formatCurrency(value)}</div>
    </div>
  );
}
