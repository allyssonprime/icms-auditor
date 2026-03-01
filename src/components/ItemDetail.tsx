import type { ItemValidation } from '../types/validation.ts';
import { CENARIOS } from '../engine/cenarios.ts';
import { formatNCM } from '../utils/formatters.ts';

interface ItemDetailProps {
  iv: ItemValidation;
}

const statusBg: Record<string, string> = {
  OK: 'bg-green-50 border-green-200',
  ALERTA: 'bg-yellow-50 border-yellow-200',
  ERRO: 'bg-red-50 border-red-200',
};

const dotColors: Record<string, string> = {
  OK: 'bg-green-500',
  ALERTA: 'bg-yellow-400',
  ERRO: 'bg-red-500',
};

function findResult(iv: ItemValidation, prefix: string) {
  return iv.resultados.find(r => r.regra.startsWith(prefix));
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'OK') return <span className="text-green-600 font-bold">OK</span>;
  if (status === 'ALERTA') return <span className="text-yellow-600 font-bold">!</span>;
  return <span className="text-red-600 font-bold">X</span>;
}

function CompareCell({ actual, expected, status }: { actual: string; expected: string; status: string }) {
  const isMatch = status === 'OK';
  const isError = status === 'ERRO';

  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono font-semibold ${isError ? 'text-red-700' : isMatch ? 'text-green-800' : 'text-yellow-700'}`}>
        {actual}
      </span>
      {!isMatch && (
        <>
          <span className="text-gray-400 text-[10px]">esperado</span>
          <span className="font-mono text-gray-600">{expected}</span>
        </>
      )}
    </div>
  );
}

export function ItemDetail({ iv }: ItemDetailProps) {
  const cenario = CENARIOS[iv.cenario];
  const cenarioNome = cenario ? cenario.nome : iv.cenario;

  const aliqResult = findResult(iv, 'AL');
  const cstResult = findResult(iv, 'CST');
  const cfopResult = findResult(iv, 'CF');

  const aliqEsperada = cenario
    ? cenario.aliquotasAceitas.map(a => `${a}%`).join(' / ')
    : '-';
  const cstOrigEsperado = '1 / 6 / 7';
  const cfopEsperado = cenario
    ? cenario.cfopsEsperados.join(' / ')
    : '-';

  const aliqStatus = aliqResult?.status ?? 'OK';
  const cstStatus = cstResult?.status ?? 'OK';
  const cfopStatus = cfopResult?.status ?? 'OK';

  const nonOkResults = iv.resultados.filter(r => r.status !== 'OK');

  return (
    <div className={`rounded-lg border p-3 mb-2 ${statusBg[iv.statusFinal] ?? 'bg-gray-50 border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColors[iv.statusFinal] ?? 'bg-gray-400'}`} />
        <span className="font-semibold text-sm text-gray-800">
          Item {iv.item.nItem}
        </span>
        <span className="font-mono text-sm text-gray-600">{formatNCM(iv.item.ncm)}</span>
        <span className="text-xs text-gray-500 truncate">{iv.item.descricao}</span>
      </div>

      {/* Cenário */}
      <div className="mb-2 ml-[18px]">
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-white/70 border border-gray-200">
          <span className="font-mono font-semibold text-gray-700">{iv.cenario}</span>
          <span className="text-gray-500">{cenarioNome}</span>
        </span>
      </div>

      {/* Comparison grid */}
      <div className="ml-[18px] border border-gray-200/60 rounded overflow-hidden bg-white/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100/50">
              <th className="text-left px-2.5 py-1.5 font-medium text-gray-500 w-[90px]">Campo</th>
              <th className="text-left px-2.5 py-1.5 font-medium text-gray-500">NF-e</th>
              <th className="text-center px-2.5 py-1.5 font-medium text-gray-500 w-[40px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-2.5 py-1.5 text-gray-600 font-medium">Aliquota</td>
              <td className="px-2.5 py-1.5">
                <CompareCell
                  actual={`${iv.item.pICMS}%`}
                  expected={aliqEsperada}
                  status={aliqStatus}
                />
              </td>
              <td className="px-2.5 py-1.5 text-center"><CheckIcon status={aliqStatus} /></td>
            </tr>
            <tr>
              <td className="px-2.5 py-1.5 text-gray-600 font-medium">CST Orig</td>
              <td className="px-2.5 py-1.5">
                <CompareCell
                  actual={`${iv.item.cstOrig} (${iv.item.cst})`}
                  expected={cstOrigEsperado}
                  status={cstStatus}
                />
              </td>
              <td className="px-2.5 py-1.5 text-center"><CheckIcon status={cstStatus} /></td>
            </tr>
            <tr>
              <td className="px-2.5 py-1.5 text-gray-600 font-medium">CFOP</td>
              <td className="px-2.5 py-1.5">
                <CompareCell
                  actual={iv.item.cfop}
                  expected={cfopEsperado}
                  status={cfopStatus}
                />
              </td>
              <td className="px-2.5 py-1.5 text-center"><CheckIcon status={cfopStatus} /></td>
            </tr>
            <tr className="bg-gray-50/50">
              <td className="px-2.5 py-1.5 text-gray-600 font-medium">BC ICMS</td>
              <td className="px-2.5 py-1.5 font-mono text-gray-700">
                {iv.item.vBC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-2.5 py-1.5"></td>
            </tr>
            <tr className="bg-gray-50/50">
              <td className="px-2.5 py-1.5 text-gray-600 font-medium">ICMS</td>
              <td className="px-2.5 py-1.5 font-mono text-gray-700">
                {iv.item.vICMS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-2.5 py-1.5"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Messages for non-OK results */}
      {nonOkResults.length > 0 && (
        <div className="ml-[18px] mt-2 space-y-1">
          {nonOkResults.map((r, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-1.5 text-xs rounded px-2 py-1.5 ${
                r.status === 'ERRO'
                  ? 'bg-red-100/60 text-red-700'
                  : 'bg-yellow-100/60 text-yellow-700'
              }`}
            >
              <span className="font-mono font-semibold shrink-0">[{r.regra}]</span>
              <span>{r.mensagem}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
