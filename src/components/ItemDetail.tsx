import type { ItemValidation } from '../types/validation.ts';
import { CENARIOS } from '../engine/cenarios.ts';
import { formatNCM } from '../utils/formatters.ts';

interface ItemDetailProps {
  iv: ItemValidation;
}

const statusColors: Record<string, string> = {
  OK: 'text-green-700 bg-green-50',
  ALERTA: 'text-yellow-700 bg-yellow-50',
  ERRO: 'text-red-700 bg-red-50',
};

const dotColors: Record<string, string> = {
  OK: 'bg-green-500',
  ALERTA: 'bg-yellow-400',
  ERRO: 'bg-red-500',
};

export function ItemDetail({ iv }: ItemDetailProps) {
  const cenario = CENARIOS[iv.cenario];
  const aliqEsperada = cenario
    ? cenario.aliquotasAceitas.map(a => `${a}%`).join(' ou ')
    : '-';
  const cstEsperado = cenario
    ? cenario.cstEsperado.join(' ou ')
    : '-';

  return (
    <div className={`rounded p-3 mb-2 ${statusColors[iv.statusFinal] ?? 'bg-gray-50'}`}>
      <div className="flex items-start gap-2">
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotColors[iv.statusFinal] ?? 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">
              Item {iv.item.nItem}: {formatNCM(iv.item.ncm)}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/60 font-mono">
              {iv.cenario}
            </span>
            <span className="text-xs">{iv.item.descricao}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
            <span>
              Aliq: <b>{iv.item.pICMS}%</b> (esperado: {aliqEsperada})
            </span>
            <span>
              CST: <b>{iv.item.cst}</b> (esperado: {cstEsperado})
            </span>
            <span>CFOP: <b>{iv.item.cfop}</b></span>
            <span>BC: {iv.item.vBC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>

          {iv.resultados
            .filter(r => r.status !== 'OK')
            .map((r, idx) => (
              <div key={idx} className="mt-1 text-xs">
                <span className={`font-medium ${r.status === 'ERRO' ? 'text-red-600' : 'text-yellow-600'}`}>
                  [{r.regra}]
                </span>{' '}
                {r.mensagem}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
