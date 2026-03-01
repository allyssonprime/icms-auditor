import { useState } from 'react';
import { CENARIOS } from '../engine/cenarios.ts';

const CENARIO_GROUPS = [
  {
    title: 'Interestaduais',
    ids: ['A1', 'A2', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
  },
  {
    title: 'Internos (SC)',
    ids: ['B1', 'B2', 'B3', 'B4', 'B4-CAMEX', 'B5', 'B5-CAMEX', 'B6', 'B6-CAMEX', 'B7', 'B9', 'B10', 'B11', 'B12'],
  },
];

export function CenarioLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-gray-50"
      >
        <h2 className="text-sm font-semibold text-gray-700">Legenda de Cenarios</h2>
        <span className="text-gray-400 text-sm">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="px-6 pb-4">
          {CENARIO_GROUPS.map(group => (
            <div key={group.title} className="mb-4 last:mb-0">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {group.ids.map(id => {
                  const c = CENARIOS[id];
                  if (!c) return null;
                  return (
                    <div key={id} className="flex items-start gap-2 text-xs py-1">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded shrink-0 min-w-[60px] text-center">
                        {id}
                      </span>
                      <span className="text-gray-600">{c.nome}</span>
                      <span className="text-gray-400 ml-auto shrink-0">
                        {c.aliquotasAceitas.length > 0
                          ? c.aliquotasAceitas.map(a => `${a}%`).join('/')
                          : 'dif.'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Outros
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
              <div className="flex items-start gap-2 py-1">
                <span className="font-mono font-bold text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded shrink-0 min-w-[60px] text-center">DEVOLUCAO</span>
                <span className="text-gray-600">Devolucao de mercadoria (estornar CP)</span>
              </div>
              <div className="flex items-start gap-2 py-1">
                <span className="font-mono font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded shrink-0 min-w-[60px] text-center">VEDADO</span>
                <span className="text-gray-600">Item vedado (Decreto 2128 ou similar)</span>
              </div>
              <div className="flex items-start gap-2 py-1">
                <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 min-w-[60px] text-center">DESC.</span>
                <span className="text-gray-600">Cenario nao identificado (verificar manual)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
