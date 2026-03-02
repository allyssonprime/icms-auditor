import { useState, useCallback } from 'react';
import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import { consultarCnpj, getCachedCnpj, getQueueSize } from '../engine/cnpjaClient.ts';
import { formatCNPJ } from '../utils/formatters.ts';

interface CnpjLookupPanelProps {
  results: NfeValidation[];
  onCnpjInfoLoaded?: (info: CnpjInfo) => void;
}

export function CnpjLookupPanel({ results, onCnpjInfoLoaded }: CnpjLookupPanelProps) {
  const [lookupResults, setLookupResults] = useState<Map<string, CnpjInfo | 'loading' | 'error'>>(new Map());
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Collect unique dest CNPJs that have validation issues
  const cnpjsWithIssues = new Set<string>();
  const allDestCnpjs = new Set<string>();

  for (const r of results) {
    const cnpj = r.nfe.dest.cnpj;
    if (!cnpj) continue;
    allDestCnpjs.add(cnpj);
    if (r.statusFinal !== 'OK') {
      cnpjsWithIssues.add(cnpj);
    }
  }

  const lookupSingle = useCallback(async (cnpj: string) => {
    const cached = getCachedCnpj(cnpj);
    if (cached) {
      setLookupResults(prev => new Map(prev).set(cnpj, cached));
      return;
    }

    setLookupResults(prev => new Map(prev).set(cnpj, 'loading'));
    const info = await consultarCnpj(cnpj);
    if (info) {
      setLookupResults(prev => new Map(prev).set(cnpj, info));
      onCnpjInfoLoaded?.(info);
    } else {
      setLookupResults(prev => new Map(prev).set(cnpj, 'error'));
    }
  }, [onCnpjInfoLoaded]);

  const lookupDivergent = useCallback(async () => {
    setIsLookingUp(true);
    const cnpjs = Array.from(cnpjsWithIssues);
    setProgress({ done: 0, total: cnpjs.length });

    for (let i = 0; i < cnpjs.length; i++) {
      await lookupSingle(cnpjs[i]!);
      setProgress({ done: i + 1, total: cnpjs.length });
    }
    setIsLookingUp(false);
  }, [cnpjsWithIssues, lookupSingle]);

  if (results.length === 0) return null;

  const queueSize = getQueueSize();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Consulta CNPJ (CNPJa)</h2>
      <p className="text-xs text-gray-500 mb-3">
        API gratuita limitada a 5 req/min. Consultas apenas de CNPJs com divergencias.
        {queueSize > 0 && <span className="ml-2 text-yellow-600">Fila: {queueSize} pendentes</span>}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={lookupDivergent}
          disabled={isLookingUp || cnpjsWithIssues.size === 0}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLookingUp
            ? `Consultando... (${progress.done}/${progress.total})`
            : `Consultar divergentes (${cnpjsWithIssues.size})`}
        </button>
        <span className="text-xs text-gray-400 self-center">
          {allDestCnpjs.size} CNPJs unicos / {lookupResults.size} consultados
        </span>
      </div>

      {lookupResults.size > 0 && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">CNPJ</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Razao Social</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Simples</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">CNAE Principal</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Descricao CNAE</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Industrial</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(lookupResults.entries()).map(([cnpj, data]) => (
                <tr key={cnpj} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-mono">{formatCNPJ(cnpj)}</td>
                  {data === 'loading' ? (
                    <td colSpan={5} className="px-2 py-1.5 text-gray-400">Consultando...</td>
                  ) : data === 'error' ? (
                    <td colSpan={5} className="px-2 py-1.5 text-red-500">
                      Erro na consulta
                      <button
                        onClick={() => lookupSingle(cnpj)}
                        className="ml-2 text-blue-600 underline"
                      >
                        Tentar novamente
                      </button>
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 truncate max-w-[200px]" title={data.razaoSocial}>
                        {data.razaoSocial || '-'}
                      </td>
                      <td className="px-2 py-1.5">
                        {data.simplesOptante === true && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">SN</span>
                        )}
                        {data.simplesOptante === false && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Nao</span>
                        )}
                        {data.simplesOptante === null && '-'}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {data.cnaePrincipal || '-'}
                      </td>
                      <td className="px-2 py-1.5 truncate max-w-[250px]" title={data.cnaeDescricao}>
                        {data.cnaeDescricao || '-'}
                      </td>
                      <td className="px-2 py-1.5">
                        {data.isIndustrial ? (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Sim</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Nao</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
