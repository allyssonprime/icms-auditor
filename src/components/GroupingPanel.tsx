import { useMemo } from 'react';
import type { NfeValidation, ActiveFilters, GroupedData, CnpjInfo } from '../types/validation.ts';
import { formatCurrency } from '../utils/formatters.ts';

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
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Agrupamentos e Filtros</h2>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por CNPJ, IE, razao social..."
          value={filters.searchText}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Quick groups */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-gray-500 self-center mr-1">Rapido:</span>
        {aliquotaValues.map(aliq => (
          <QuickButton
            key={`aliq-${aliq}`}
            label={`${aliq}%`}
            onClick={() => onQuickGroup('aliquota', [aliq])}
            active={filters.aliquota.has(aliq) && filters.aliquota.size === 1}
          />
        ))}
        <span className="text-gray-300">|</span>
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
        <span className="text-gray-300">|</span>
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
    </div>
  );
}

function QuickButton({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
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
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-2 py-1.5 font-medium text-gray-600">Valor</th>
              <th className="text-right px-2 py-1.5 font-medium text-gray-600">Itens</th>
              <th className="text-right px-2 py-1.5 font-medium text-gray-600">BC ICMS</th>
              <th className="text-right px-2 py-1.5 font-medium text-gray-600">ICMS</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const key = getKey(g);
              const isActive = activeSet.has(key);
              return (
                <tr
                  key={g.label}
                  onClick={() => onToggle(key)}
                  className={`cursor-pointer hover:bg-blue-50 ${isActive ? 'bg-blue-100' : ''}`}
                >
                  <td className="px-2 py-1.5 font-mono">{g.label}</td>
                  <td className="px-2 py-1.5 text-right">{g.count}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(g.totalBC)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(g.totalICMS)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
