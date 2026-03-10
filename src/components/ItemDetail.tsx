import type { ItemValidation, CrossCheckSeverity } from '../types/validation.ts';
import { CENARIOS } from '../engine/cenarios.ts';
import { formatNCM } from '../utils/formatters.ts';
import { Check, AlertTriangle, X, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ItemDetailProps {
  iv: ItemValidation;
}

const statusBg: Record<string, string> = {
  OK: 'bg-card border-border',
  ALERTA: 'bg-warning-50/40 border-warning-200/60',
  ERRO: 'bg-danger-50/40 border-danger-200/60',
};

const dotColors: Record<string, string> = {
  OK: 'bg-success-400',
  ALERTA: 'bg-warning-400',
  ERRO: 'bg-danger-500',
};

const severityColor: Record<CrossCheckSeverity, string> = {
  ok: 'text-success-600',
  atencao: 'text-warning-600',
  divergente: 'text-danger-500',
};

const severityLabelColor: Record<CrossCheckSeverity, string> = {
  ok: 'text-muted-foreground',
  atencao: 'text-warning-700 font-medium',
  divergente: 'text-danger-700 font-medium',
};

function SeverityIcon({ severity }: { severity: CrossCheckSeverity }) {
  if (severity === 'ok') return <Check size={12} className="text-success-500" />;
  if (severity === 'atencao') return <AlertTriangle size={12} className="text-warning-500" />;
  return <X size={12} className="text-danger-500" />;
}

function findResult(iv: ItemValidation, prefix: string) {
  return iv.resultados.find(r => r.regra.startsWith(prefix));
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'OK') return <CheckCircle2 size={14} className="text-success-500" />;
  if (status === 'ALERTA') return <AlertCircle size={14} className="text-warning-500" />;
  return <XCircle size={14} className="text-danger-600" />;
}

function CompareCell({ actual, expected, status }: { actual: string; expected: string; status: string }) {
  const isMatch = status === 'OK';
  const isError = status === 'ERRO';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={cn('font-mono font-semibold', isError ? 'text-danger-700' : isMatch ? 'text-success-700' : 'text-warning-700')}>
        {actual}
      </span>
      {!isMatch && (
        <>
          <span className="text-muted-foreground/70 text-[10px]">esperado</span>
          <span className="font-mono text-muted-foreground text-[10px]">{expected}</span>
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

  const aliqEsperada = cenario ? cenario.aliquotasAceitas.map(a => `${a}%`).join(' / ') : '-';
  const cstOrigEsperado = '1 / 6 / 7';
  const cfopEsperado = cenario ? cenario.cfopsEsperados.join(' / ') : '-';

  const aliqStatus = aliqResult?.status ?? 'OK';
  const cstStatus = cstResult?.status ?? 'OK';
  const cfopStatus = cfopResult?.status ?? 'OK';

  const nonOkResults = iv.resultados.filter(r => r.status !== 'OK');
  const hasCP = !!iv.item.cCredPresumido;
  const isOk = iv.statusFinal === 'OK';

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className={cn('rounded-lg border px-3 py-2 mb-1.5', statusBg[iv.statusFinal] ?? 'bg-card border-border')}>

      {/* -- Linha principal (sempre visivel, compacta) -- */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-px', dotColors[iv.statusFinal] ?? 'bg-muted-foreground')} />

        {/* Item N */}
        <span className="text-xs font-semibold text-foreground shrink-0">Item {iv.item.nItem}</span>

        {/* NCM */}
        <span className="font-mono text-xs text-muted-foreground shrink-0">{formatNCM(iv.item.ncm)}</span>

        {/* Descricao */}
        {iv.item.descricao && (
          <span className="text-xs text-muted-foreground/70 truncate min-w-0 max-w-[200px]" title={iv.item.descricao}>
            {iv.item.descricao}
          </span>
        )}

        {/* Separador */}
        <span className="text-border shrink-0">&middot;</span>

        {/* Cenario badge */}
        <Badge className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border-primary-100 shrink-0">
          {iv.cenario}
        </Badge>
        <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">{cenarioNome}</span>

        {/* CP badge */}
        {hasCP && (
          <Badge className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border-purple-200/60 font-semibold shrink-0">
            CP {iv.item.cCredPresumido}
          </Badge>
        )}

        {/* Valores financeiros inline */}
        <span className="text-border shrink-0">&middot;</span>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          BC <span className="font-mono text-muted-foreground font-medium">{fmtBRL(iv.item.vBC)}</span>
        </span>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          ICMS <span className="font-mono text-muted-foreground font-medium">{fmtBRL(iv.item.vICMS)}</span>
        </span>

        {/* Status check icons inline (para OK, compacto) */}
        {isOk && (
          <>
            <span className="text-border shrink-0">&middot;</span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground/70">
                {iv.item.pICMS}% &middot; CST {iv.item.cst} &middot; CFOP {iv.item.cfop}
              </span>
              <CheckCircle2 size={12} className="text-success-500" />
            </span>
          </>
        )}

        {/* Status icons para nao-OK */}
        {!isOk && (
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <CheckIcon status={aliqStatus} />
            <CheckIcon status={cstStatus} />
            <CheckIcon status={cfopStatus} />
          </span>
        )}
      </div>

      {/* -- Detalhes expandidos (apenas para itens com problema) -- */}
      {!isOk && (
        <div className="mt-2 ml-3.5 space-y-2">

          {/* Grade de comparacao */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {/* Aliquota */}
            <div className={cn('rounded-md px-2.5 py-1.5 border', aliqStatus === 'OK' ? 'bg-card border-border' : aliqStatus === 'ERRO' ? 'bg-danger-50 border-danger-200/60' : 'bg-warning-50 border-warning-200/60')}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Aliquota</span>
                <CheckIcon status={aliqStatus} />
              </div>
              <CompareCell actual={`${iv.item.pICMS}%`} expected={aliqEsperada} status={aliqStatus} />
            </div>
            {/* CST */}
            <div className={cn('rounded-md px-2.5 py-1.5 border', cstStatus === 'OK' ? 'bg-card border-border' : cstStatus === 'ERRO' ? 'bg-danger-50 border-danger-200/60' : 'bg-warning-50 border-warning-200/60')}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">CST Orig</span>
                <CheckIcon status={cstStatus} />
              </div>
              <CompareCell actual={`${iv.item.cstOrig} (${iv.item.cst})`} expected={cstOrigEsperado} status={cstStatus} />
            </div>
            {/* CFOP */}
            <div className={cn('rounded-md px-2.5 py-1.5 border', cfopStatus === 'OK' ? 'bg-card border-border' : cfopStatus === 'ERRO' ? 'bg-danger-50 border-danger-200/60' : 'bg-warning-50 border-warning-200/60')}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">CFOP</span>
                <CheckIcon status={cfopStatus} />
              </div>
              <CompareCell actual={iv.item.cfop} expected={cfopEsperado} status={cfopStatus} />
            </div>
          </div>

          {/* CP (se houver) */}
          {hasCP && (
            <div className="text-xs font-mono text-purple-700 bg-purple-50 border border-purple-200/60 rounded-md px-2.5 py-1.5">
              CP {iv.item.cCredPresumido}
              {iv.item.pCredPresumido > 0 && ` (${iv.item.pCredPresumido}%)`}
              {iv.item.vCredPresumido > 0 && ` = ${fmtBRL(iv.item.vCredPresumido)}`}
            </div>
          )}

          {/* Mensagens de erro/alerta */}
          {nonOkResults.length > 0 && (
            <div className="space-y-1">
              {nonOkResults.map((r, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-1.5 text-xs rounded-md px-2.5 py-1.5',
                    r.status === 'ERRO'
                      ? 'bg-danger-50 text-danger-700 border border-danger-200/60'
                      : 'bg-warning-50 text-warning-700 border border-warning-200/60'
                  )}
                >
                  <span className="font-mono font-bold shrink-0">[{r.regra}]</span>
                  <span>{r.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cross-checks */}
          {iv.crossChecks.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1">
                Verificacoes ({iv.item.pICMS}%)
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {iv.crossChecks.map((ck, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs">
                    <span className={cn('shrink-0', severityColor[ck.severity])}>
                      <SeverityIcon severity={ck.severity} />
                    </span>
                    <span className={severityLabelColor[ck.severity]}>{ck.label}</span>
                    <span className={cn('font-bold ml-0.5', ck.passed ? 'text-success-600' : 'text-danger-500')}>
                      {ck.passed ? 'SIM' : 'NAO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cross-checks para itens OK com verificacoes importantes */}
      {isOk && iv.crossChecks.some(ck => ck.severity !== 'ok') && (
        <div className="mt-1.5 ml-3.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {iv.crossChecks.filter(ck => ck.severity !== 'ok').map((ck, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs">
              <span className={cn('shrink-0', severityColor[ck.severity])}>
                <SeverityIcon severity={ck.severity} />
              </span>
              <span className={severityLabelColor[ck.severity]}>{ck.label}</span>
              <span className={cn('font-bold ml-0.5', ck.passed ? 'text-success-600' : 'text-danger-500')}>
                {ck.passed ? 'SIM' : 'NAO'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
