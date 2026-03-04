import { useState } from 'react';
import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import { ItemDetail } from './ItemDetail.tsx';
import { formatCNPJ, formatCurrency } from '../utils/formatters.ts';
import { isNaoContribuinte } from '../engine/aliquota.ts';

function formatDhEmi(dhEmi: string): string {
  if (!dhEmi) return '-';
  try {
    const d = new Date(dhEmi);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return dhEmi; }
}

interface NfeCardProps {
  validation: NfeValidation;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}

const borderColors: Record<string, string> = {
  OK: 'border-l-green-500',
  ALERTA: 'border-l-yellow-400',
  ERRO: 'border-l-red-500',
};

const dotColors: Record<string, string> = {
  OK: 'bg-green-500',
  ALERTA: 'bg-yellow-400',
  ERRO: 'bg-red-500',
};

export function NfeCard({ validation, cnpjInfoMap }: NfeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { nfe, itensValidados, statusFinal } = validation;

  const countOk = itensValidados.filter(i => i.statusFinal === 'OK').length;
  const countAlerta = itensValidados.filter(i => i.statusFinal === 'ALERTA').length;
  const countErro = itensValidados.filter(i => i.statusFinal === 'ERRO').length;

  const destCnpjInfo = nfe.dest.cnpj ? cnpjInfoMap?.get(nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
  const isNC = isNaoContribuinte(nfe.dest);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 border-l-4 mb-3 ${borderColors[statusFinal] ?? 'border-l-gray-400'}`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`w-3 h-3 rounded-full shrink-0 ${dotColors[statusFinal] ?? 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">
              NF {nfe.numero}
            </span>
            {nfe.dhEmi && (
              <span className="text-xs text-gray-400 font-mono">{formatDhEmi(nfe.dhEmi)}</span>
            )}
            <span className="text-sm text-gray-500">
              {nfe.dest.nome} ({nfe.dest.uf})
            </span>
            {destCnpjInfo?.simplesOptante === true && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">SN</span>
            )}
            {destCnpjInfo?.isIndustrial && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Industrial</span>
            )}
            {isNC && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-medium">NC</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {itensValidados.length} {itensValidados.length === 1 ? 'item' : 'itens'}:
            {countOk > 0 && <span className="text-green-600 ml-2">{countOk} OK</span>}
            {countAlerta > 0 && <span className="text-yellow-600 ml-2">{countAlerta} alerta{countAlerta > 1 ? 's' : ''}</span>}
            {countErro > 0 && <span className="text-red-600 ml-2">{countErro} erro{countErro > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <span className="text-gray-400 text-sm">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="bg-gray-50 rounded p-3 mb-3 text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-gray-700">Emitente:</span>{' '}
              {nfe.emitNome || '-'}{' '}
              <span className="font-mono">{nfe.emitCnpj ? formatCNPJ(nfe.emitCnpj) : '-'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Destinatario:</span>{' '}
              {nfe.dest.nome}{' '}
              <span className="font-mono">
                {nfe.dest.cnpj ? formatCNPJ(nfe.dest.cnpj) : nfe.dest.cpf || '-'}
              </span>
              {destCnpjInfo?.simplesOptante === true && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                  Simples Nacional
                </span>
              )}
              {destCnpjInfo?.isIndustrial && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                  Industrial ({destCnpjInfo.cnaeDescricao || destCnpjInfo.cnaePrincipal})
                </span>
              )}
              {isNC && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-medium">
                  Nao-contribuinte
                </span>
              )}
            </div>
            {nfe.dest.ie && (
              <div>
                <span className="font-medium text-gray-700">IE Destinatario:</span>{' '}
                <span className="font-mono">{nfe.dest.ie}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">indIEDest:</span>{' '}
              <span className="font-mono">{nfe.dest.indIEDest}</span>
              <span className="text-gray-400 ml-1">
                ({nfe.dest.indIEDest === '1' ? 'Contribuinte' : nfe.dest.indIEDest === '2' ? 'Isento' : nfe.dest.indIEDest === '9' ? 'Nao-contribuinte' : 'Outro'})
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Chave:</span>{' '}
              <span className="font-mono">{nfe.chaveAcesso}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Emissão:</span>{' '}
              {formatDhEmi(nfe.dhEmi)}
            </div>
            <div>
              <span className="font-medium text-gray-700">Nat. Op.:</span>{' '}
              {nfe.natOp}
            </div>
            <div>
              <span className="font-medium text-gray-700">Total BC:</span>{' '}
              {formatCurrency(validation.totalBC)}
            </div>
            <div>
              <span className="font-medium text-gray-700">ICMS Dest.:</span>{' '}
              {formatCurrency(validation.totalICMSDestacado)}
            </div>
          </div>

          {itensValidados.map((iv, idx) => (
            <ItemDetail key={idx} iv={iv} />
          ))}
        </div>
      )}
    </div>
  );
}
