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
  const totalICMSDestacado = results.reduce((s, r) => s + r.totalICMSDestacado, 0);
  const totalICMSRecolher = results.reduce((s, r) => s + r.totalICMSRecolher, 0);
  const totalFundos = results.reduce((s, r) => s + r.totalFundos, 0);
  const totalRecolherComFundos = totalICMSRecolher + totalFundos;

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
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
        <TotalCard label="Total BC ICMS" value={totalBC} />
        <TotalCard label="ICMS Destacado" value={totalICMSDestacado} />
        <TotalCard label="ICMS a Recolher" value={totalICMSRecolher} accent="blue" />
        <TotalCard label="Fundos (0,4%)" value={totalFundos} accent="purple" />
        <TotalCard label="Total Recolher" value={totalRecolherComFundos} accent="red" />
      </div>
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
