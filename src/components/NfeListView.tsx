import { useState } from 'react';
import type { NfeValidation, ActiveFilters, CnpjInfo } from '../types/validation.ts';
import { NfeCard } from './NfeCard.tsx';
import { formatCNPJ, formatCurrency } from '../utils/formatters.ts';

interface NfeListViewProps {
  results: NfeValidation[];
  filters: ActiveFilters;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}

const statusBadge: Record<string, string> = {
  OK: 'bg-green-100 text-green-700',
  ALERTA: 'bg-yellow-100 text-yellow-700',
  ERRO: 'bg-red-100 text-red-700',
};

function matchesFilters(v: NfeValidation, filters: ActiveFilters): boolean {
  const hasAny =
    filters.aliquota.size > 0 ||
    filters.cst.size > 0 ||
    filters.cfop.size > 0 ||
    filters.cenario.size > 0 ||
    filters.status.size > 0;

  if (!hasAny) return true;

  // Status filter applies at NF level
  if (filters.status.size > 0 && !filters.status.has(v.statusFinal)) return false;

  // Item-level filters: at least one item must match all active item filters
  if (filters.aliquota.size > 0 || filters.cst.size > 0 || filters.cfop.size > 0 || filters.cenario.size > 0) {
    return v.itensValidados.some(iv => {
      if (filters.aliquota.size > 0 && !filters.aliquota.has(iv.item.pICMS)) return false;
      if (filters.cst.size > 0 && !filters.cst.has(iv.item.cst)) return false;
      if (filters.cfop.size > 0 && !filters.cfop.has(iv.item.cfop)) return false;
      if (filters.cenario.size > 0 && !filters.cenario.has(iv.cenario)) return false;
      return true;
    });
  }

  return true;
}

export function NfeListView({ results, filters, cnpjInfoMap }: NfeListViewProps) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const filtered = results.filter(v => matchesFilters(v, filters));

  if (results.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Notas Fiscais
          {filtered.length !== results.length && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filtered.length} de {results.length})
            </span>
          )}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => { setView('table'); setSelectedIdx(null); }}
            className={`text-xs px-2 py-1 rounded ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Tabela
          </button>
          <button
            onClick={() => { setView('cards'); setSelectedIdx(null); }}
            className={`text-xs px-2 py-1 rounded ${view === 'cards' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Cards
          </button>
        </div>
      </div>

      {view === 'table' && (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">NF</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Emitente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Destinatario</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">UF</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Itens</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">BC ICMS</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">ICMS</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                    className={`cursor-pointer hover:bg-blue-50 border-t border-gray-100 ${selectedIdx === idx ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono font-medium">{v.nfe.numero}</td>
                    <td className="px-3 py-2">
                      <div className="truncate max-w-[150px]" title={v.nfe.emitNome}>
                        {v.nfe.emitCnpj ? formatCNPJ(v.nfe.emitCnpj) : '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[130px]" title={v.nfe.dest.nome}>
                          {v.nfe.dest.cnpj ? formatCNPJ(v.nfe.dest.cnpj) : v.nfe.dest.cpf || '-'}
                        </span>
                        {(() => {
                          const info = v.nfe.dest.cnpj ? cnpjInfoMap?.get(v.nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
                          return (
                            <>
                              {info?.simplesOptante === true && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-medium shrink-0">SN</span>
                              )}
                              {info?.isIndustrial && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium shrink-0">Ind</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2">{v.nfe.dest.uf}</td>
                    <td className="px-3 py-2 text-right">{v.itensValidados.length}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(v.totalBC)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(v.totalICMSDestacado)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge[v.statusFinal] ?? 'bg-gray-100 text-gray-600'}`}>
                        {v.statusFinal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedIdx !== null && filtered[selectedIdx] && (
            <NfeCard validation={filtered[selectedIdx]} cnpjInfoMap={cnpjInfoMap} />
          )}
        </>
      )}

      {view === 'cards' && (
        <div>
          {filtered.map((r, idx) => (
            <NfeCard key={idx} validation={r} cnpjInfoMap={cnpjInfoMap} />
          ))}
        </div>
      )}
    </div>
  );
}
