import type { NfeValidation } from '../types/validation.ts';
import { formatCurrency } from '../utils/formatters.ts';

interface DashboardProps {
  results: NfeValidation[];
}

export function Dashboard({ results }: DashboardProps) {
  if (results.length === 0) return null;

  const totalNfes = results.length;
  const nfesOk = results.filter(r => r.statusFinal === 'OK').length;
  const nfesAlerta = results.filter(r => r.statusFinal === 'ALERTA').length;
  const nfesErro = results.filter(r => r.statusFinal === 'ERRO').length;
  const totalBC = results.reduce((s, r) => s + r.totalBC, 0);
  const totalFundos = results.reduce((s, r) => s + r.totalFundos, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumo</h2>

      <div className="flex flex-wrap gap-6 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-green-500 inline-block" />
          <span className="text-2xl font-bold text-green-700">{nfesOk}</span>
          <span className="text-sm text-gray-500">NF-e OK</span>
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
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm text-gray-600">
        <div>
          <span className="font-medium">Total BC:</span>{' '}
          {formatCurrency(totalBC)}
        </div>
        <div>
          <span className="font-medium">Fundos estimados (0,4%):</span>{' '}
          {formatCurrency(totalFundos)}
        </div>
      </div>
    </div>
  );
}
