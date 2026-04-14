import { useState } from 'react';
import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import { ItemDetail } from './ItemDetail.tsx';
import { formatCNPJ, formatCurrency } from '../utils/formatters.ts';
import { isNaoContribuinte } from '../engine/aliquota.ts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RegrasConfig } from '../types/regras.ts';

interface NfeCardProps {
  validation: NfeValidation;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  regras: RegrasConfig;
}

const dotColors: Record<string, string> = {
  OK: 'bg-success-500',
  INFO: 'bg-sky-400',
  AVISO: 'bg-warning-400',
  DIVERGENCIA: 'bg-orange-500',
  ERRO: 'bg-danger-500',
};

export function NfeCard({ validation, cnpjInfoMap, regras }: NfeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { nfe, itensValidados, statusFinal } = validation;

  const countOk = itensValidados.filter(i => i.statusFinal === 'OK').length;
  const countInfo = itensValidados.filter(i => i.statusFinal === 'INFO').length;
  const countAviso = itensValidados.filter(i => i.statusFinal === 'AVISO').length;
  const countDivergencia = itensValidados.filter(i => i.statusFinal === 'DIVERGENCIA').length;
  const countErro = itensValidados.filter(i => i.statusFinal === 'ERRO').length;

  const destCnpjInfo = nfe.dest.cnpj ? cnpjInfoMap?.get(nfe.dest.cnpj.replace(/\D/g, '')) : undefined;
  const isNC = isNaoContribuinte(nfe.dest);

  return (
    <Card
      className={cn(
        'border-0 mb-2 transition-shadow duration-200 shadow-card hover:shadow-lg bg-white/70 backdrop-blur-xl group relative overflow-hidden',
      )}
    >
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-1 opacity-60', dotColors[statusFinal] ?? 'bg-muted-foreground')}
      />
      <div
        className="flex items-center gap-3 py-2.5 pr-3 pl-4 cursor-pointer select-none hover:bg-white/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0 shadow-sm', dotColors[statusFinal] ?? 'bg-muted-foreground')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">
              NF {nfe.numero}
            </span>
            <span className="text-xs text-muted-foreground">
              {nfe.dest.nome} ({nfe.dest.uf})
            </span>
            {isNC ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-medium bg-muted text-foreground">NC</Badge>
            ) : (
              <>
                {destCnpjInfo?.simplesOptante === true && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-medium bg-orange-100 text-orange-700 border-orange-200">SN</Badge>
                )}
                {destCnpjInfo?.isMei === true && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-medium bg-purple-100 text-purple-700 border-purple-200">MEI</Badge>
                )}
                {destCnpjInfo?.isIndustrial && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded font-medium bg-primary-100 text-primary-700 border-primary-200">Industrial</Badge>
                )}
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {itensValidados.length} {itensValidados.length === 1 ? 'item' : 'itens'}:
            {countOk > 0 && <span className="text-success-600 ml-1.5">{countOk} OK</span>}
            {countInfo > 0 && <span className="text-sky-600 ml-1.5">{countInfo} info</span>}
            {countAviso > 0 && <span className="text-warning-600 ml-1.5">{countAviso} aviso{countAviso > 1 ? 's' : ''}</span>}
            {countDivergencia > 0 && <span className="text-orange-600 ml-1.5">{countDivergencia} diverg.</span>}
            {countErro > 0 && <span className="text-danger-600 ml-1.5">{countErro} erro{countErro > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {expanded && (
        <CardContent className="px-3 pb-2.5 pt-0">
          {/* Metadata compacto - 2 linhas densas */}
          <div className="bg-neutral-50/80 rounded-md px-2.5 py-1.5 mb-2 text-[11px] text-muted-foreground border border-white/60 space-y-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-foreground">Emitente:</span>
              <span>{nfe.emitNome || '-'}</span>
              <span className="font-mono">{nfe.emitCnpj ? formatCNPJ(nfe.emitCnpj) : '-'}</span>
              <span className="text-border">&middot;</span>
              <span className="font-medium text-foreground">Destinatario:</span>
              <span>{nfe.dest.nome}</span>
              <span className="font-mono">{nfe.dest.cnpj ? formatCNPJ(nfe.dest.cnpj) : nfe.dest.cpf || '-'}</span>
              {destCnpjInfo?.simplesOptante === true && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 rounded font-medium bg-orange-100 text-orange-700 border-orange-200">SN</Badge>
              )}
              {destCnpjInfo?.isMei === true && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 rounded font-medium bg-purple-100 text-purple-700 border-purple-200">MEI</Badge>
              )}
              {destCnpjInfo?.isIndustrial && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 rounded font-medium bg-primary-100 text-primary-700 border-primary-200">
                  Industrial ({destCnpjInfo.cnaeDescricao || destCnpjInfo.cnaePrincipal})
                </Badge>
              )}
              {isNC && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 rounded font-medium bg-muted text-foreground">NC</Badge>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap font-mono text-[10px]">
              {nfe.dest.ie && <>
                <span className="font-sans font-medium text-foreground">IE:</span>
                <span>{nfe.dest.ie}</span>
                <span className="text-border font-sans">&middot;</span>
              </>}
              <span className="font-sans font-medium text-foreground">indIEDest:</span>
              <span>{nfe.dest.indIEDest} ({nfe.dest.indIEDest === '1' ? 'Contrib.' : nfe.dest.indIEDest === '2' ? 'Isento' : nfe.dest.indIEDest === '9' ? 'NC' : 'Outro'})</span>
              <span className="text-border font-sans">&middot;</span>
              <span className="font-sans font-medium text-foreground">Chave:</span>
              <span className="truncate max-w-[280px]">{nfe.chaveAcesso}</span>
              <span className="text-border font-sans">&middot;</span>
              <span className="font-sans font-medium text-foreground">Nat.Op:</span>
              <span className="font-sans">{nfe.natOp}</span>
              <span className="text-border font-sans">&middot;</span>
              <span className="font-sans font-medium text-foreground">Total BC:</span>
              <span>{formatCurrency(validation.totalBC)}</span>
              <span className="text-border font-sans">&middot;</span>
              <span className="font-sans font-medium text-foreground">ICMS Dest.:</span>
              <span>{formatCurrency(validation.totalICMSDestacado)}</span>
            </div>
          </div>

          {itensValidados.map((iv, idx) => (
            <ItemDetail key={idx} iv={iv} regras={regras} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
