import { useState } from 'react';
import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import { ItemDetail } from './ItemDetail.tsx';
import { formatCNPJ, formatCurrency } from '../utils/formatters.ts';
import { isNaoContribuinte } from '../engine/aliquota.ts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NfeCardProps {
  validation: NfeValidation;
  cnpjInfoMap?: Map<string, CnpjInfo>;
}

const borderColors: Record<string, string> = {
  OK: 'border-l-success-500',
  ALERTA: 'border-l-warning-400',
  ERRO: 'border-l-danger-500',
};

const dotColors: Record<string, string> = {
  OK: 'bg-success-500',
  ALERTA: 'bg-warning-400',
  ERRO: 'bg-danger-500',
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
    <Card
      className={cn(
        'border-l-4 mb-3 transition-all duration-200 hover:shadow-md shadow-xs',
        borderColors[statusFinal] ?? 'border-l-muted-foreground'
      )}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColors[statusFinal] ?? 'bg-muted-foreground')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              NF {nfe.numero}
            </span>
            <span className="text-sm text-muted-foreground">
              {nfe.dest.nome} ({nfe.dest.uf})
            </span>
            {isNC ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-foreground">Nao Contribuinte</Badge>
            ) : (
              <>
                {destCnpjInfo?.simplesOptante === true && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700 border-orange-200">SN</Badge>
                )}
                {destCnpjInfo?.isMei === true && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 border-purple-200">MEI</Badge>
                )}
                {destCnpjInfo?.isIndustrial && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary-100 text-primary-700 border-primary-200">Industrial</Badge>
                )}
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {itensValidados.length} {itensValidados.length === 1 ? 'item' : 'itens'}:
            {countOk > 0 && <span className="text-success-600 ml-2">{countOk} OK</span>}
            {countAlerta > 0 && <span className="text-warning-600 ml-2">{countAlerta} alerta{countAlerta > 1 ? 's' : ''}</span>}
            {countErro > 0 && <span className="text-danger-600 ml-2">{countErro} erro{countErro > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <span className="text-muted-foreground">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="bg-muted rounded-lg p-3 mb-3 text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="font-medium text-foreground">Emitente:</span>{' '}
              {nfe.emitNome || '-'}{' '}
              <span className="font-mono">{nfe.emitCnpj ? formatCNPJ(nfe.emitCnpj) : '-'}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Destinatario:</span>{' '}
              {nfe.dest.nome}{' '}
              <span className="font-mono">
                {nfe.dest.cnpj ? formatCNPJ(nfe.dest.cnpj) : nfe.dest.cpf || '-'}
              </span>
              {destCnpjInfo?.simplesOptante === true && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700 border-orange-200">
                  Simples Nacional
                </Badge>
              )}
              {destCnpjInfo?.isMei === true && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-700 border-purple-200">
                  MEI
                </Badge>
              )}
              {destCnpjInfo?.isIndustrial && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary-100 text-primary-700 border-primary-200">
                  Industrial ({destCnpjInfo.cnaeDescricao || destCnpjInfo.cnaePrincipal})
                </Badge>
              )}
              {isNC && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-foreground">
                  Nao-contribuinte
                </Badge>
              )}
            </div>
            {nfe.dest.ie && (
              <div>
                <span className="font-medium text-foreground">IE Destinatario:</span>{' '}
                <span className="font-mono">{nfe.dest.ie}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">indIEDest:</span>{' '}
              <span className="font-mono">{nfe.dest.indIEDest}</span>
              <span className="text-muted-foreground/70 ml-1">
                ({nfe.dest.indIEDest === '1' ? 'Contribuinte' : nfe.dest.indIEDest === '2' ? 'Isento' : nfe.dest.indIEDest === '9' ? 'Nao-contribuinte' : 'Outro'})
              </span>
            </div>
            <div>
              <span className="font-medium text-foreground">Chave:</span>{' '}
              <span className="font-mono">{nfe.chaveAcesso}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Nat. Op.:</span>{' '}
              {nfe.natOp}
            </div>
            <div>
              <span className="font-medium text-foreground">Total BC:</span>{' '}
              {formatCurrency(validation.totalBC)}
            </div>
            <div>
              <span className="font-medium text-foreground">ICMS Dest.:</span>{' '}
              {formatCurrency(validation.totalICMSDestacado)}
            </div>
          </div>

          {itensValidados.map((iv, idx) => (
            <ItemDetail key={idx} iv={iv} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
