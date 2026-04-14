import { useState } from 'react';
import type { ItemValidation, CrossCheckSeverity, AcaoRecomendada } from '../types/validation.ts';
import { getCenarios } from '../engine/cenarios.ts';
import type { RegrasConfig } from '../types/regras.ts';
import { formatNCM } from '../utils/formatters.ts';
import { Check, AlertTriangle, X, CheckCircle2, AlertCircle, XCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ItemDetailProps {
  iv: ItemValidation;
  regras: RegrasConfig;
}

const statusBg: Record<string, string> = {
  OK: 'bg-card border-border',
  INFO: 'bg-sky-50/40 border-sky-200/60',
  AVISO: 'bg-warning-50/40 border-warning-200/60',
  DIVERGENCIA: 'bg-orange-50/40 border-orange-200/60',
  ERRO: 'bg-danger-50/40 border-danger-200/60',
};

const dotColors: Record<string, string> = {
  OK: 'bg-success-400',
  INFO: 'bg-sky-400',
  AVISO: 'bg-warning-400',
  DIVERGENCIA: 'bg-orange-500',
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
  if (severity === 'ok') return <Check size={11} className="text-success-500" />;
  if (severity === 'atencao') return <AlertTriangle size={11} className="text-warning-500" />;
  return <X size={11} className="text-danger-500" />;
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'OK') return <CheckCircle2 size={12} className="text-success-500" />;
  if (status === 'INFO') return <Info size={12} className="text-sky-500" />;
  if (status === 'AVISO') return <AlertCircle size={12} className="text-warning-500" />;
  if (status === 'DIVERGENCIA') return <AlertTriangle size={12} className="text-orange-500" />;
  return <XCircle size={12} className="text-danger-600" />;
}

function InlineCompare({ label, actual, expected, status }: { label: string; actual: string; expected: string; status: string }) {
  const isMatch = status === 'OK' || status === 'INFO';
  const color =
    status === 'ERRO' ? 'text-danger-700' :
    status === 'DIVERGENCIA' ? 'text-orange-700' :
    status === 'AVISO' ? 'text-warning-700' :
    'text-foreground';
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground/70 uppercase text-[10px]">{label}</span>
      <span className={cn('font-mono font-semibold', color)}>{actual}</span>
      <CheckIcon status={status} />
      {!isMatch && (
        <span className="text-muted-foreground/60 text-[10px]">
          esp. <span className="font-mono">{expected}</span>
        </span>
      )}
    </span>
  );
}

const acaoLabels: Record<string, string> = {
  corrigir_nfe: 'Corrigir NF-e',
  verificar_documento: 'Verificar',
  verificar_cadastro: 'Verificar cadastro',
  nenhuma: '',
};

const acaoPrioridadeColors: Record<string, string> = {
  alta: 'bg-danger-50 text-danger-700 border-danger-200/60',
  media: 'bg-warning-50 text-warning-700 border-warning-200/60',
  baixa: 'bg-muted text-muted-foreground border-border',
};

function AcaoCard({ acao }: { acao: AcaoRecomendada }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border', acaoPrioridadeColors[acao.prioridade])}>
      <span className="font-semibold">{acaoLabels[acao.tipo]}</span>
      {acao.campo && <span className="font-mono">{acao.campo}</span>}
      {acao.valorAtual && acao.valorEsperado && (
        <span className="font-mono">{acao.valorAtual} → {acao.valorEsperado}</span>
      )}
    </span>
  );
}

function findResult(iv: ItemValidation, prefix: string) {
  return iv.resultados.find(r => r.regra.startsWith(prefix));
}

export function ItemDetail({ iv, regras }: ItemDetailProps) {
  const cenario = getCenarios(regras)[iv.cenario];
  const cenarioNome = cenario ? cenario.nome : iv.cenario;

  const aliqResult = findResult(iv, 'AL');
  const cstResult = findResult(iv, 'CST');
  const cfopResult = findResult(iv, 'CF');

  const aliqEsperada = cenario ? cenario.aliquotasAceitas.map(a => `${a}%`).join('/') : '-';
  const cstOrigEsperado = '1/6/7';
  const cfopEsperado = cenario ? cenario.cfopsEsperados.join('/') : '-';

  const aliqStatus = aliqResult?.status ?? 'OK';
  const cstStatus = cstResult?.status ?? 'OK';
  const cfopStatus = cfopResult?.status ?? 'OK';

  const nonOkResults = iv.resultados.filter(r => r.status !== 'OK' && r.status !== 'INFO');
  const hasCP = !!iv.item.cCredPresumido;
  const isOk = iv.statusFinal === 'OK' || iv.statusFinal === 'INFO';
  const hasErro = iv.statusFinal === 'ERRO';

  // Itens com ERRO auto-expandem, outros colapsados por default
  const [expanded, setExpanded] = useState(hasErro);

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className={cn('rounded-lg border px-3 py-1.5 mb-1', statusBg[iv.statusFinal] ?? 'bg-card border-border')}>

      {/* -- Header line (sempre visivel) -- */}
      <div
        className={cn('flex items-center gap-2 flex-wrap min-w-0', !isOk && 'cursor-pointer')}
        onClick={!isOk ? () => setExpanded(!expanded) : undefined}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[iv.statusFinal] ?? 'bg-muted-foreground')} />

        <span className="text-xs font-semibold text-foreground shrink-0">Item {iv.item.nItem}</span>
        <span className="font-mono text-xs text-muted-foreground shrink-0">{formatNCM(iv.item.ncm)}</span>

        {iv.item.descricao && (
          <span className="text-xs text-muted-foreground/70 truncate min-w-0 max-w-[250px]" title={iv.item.descricao}>
            {iv.item.descricao}
          </span>
        )}

        <span className="text-border shrink-0">&middot;</span>

        <Badge className="text-[10px] font-mono font-bold px-1.5 py-0 rounded bg-primary-50 text-primary-700 border-primary-100 shrink-0">
          {iv.cenario}
        </Badge>
        <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">{cenarioNome}</span>

        {hasCP && (
          <Badge className="text-[10px] px-1.5 py-0 rounded-full bg-purple-50 text-purple-700 border-purple-200/60 font-semibold shrink-0">
            CP {iv.item.cCredPresumido}
          </Badge>
        )}

        <span className="text-border shrink-0">&middot;</span>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          BC <span className="font-mono text-muted-foreground font-medium">{fmtBRL(iv.item.vBC)}</span>
        </span>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          ICMS <span className="font-mono text-muted-foreground font-medium">{fmtBRL(iv.item.vICMS)}</span>
        </span>

        {/* OK/INFO: mostra dados inline + check */}
        {isOk && (
          <>
            <span className="text-border shrink-0">&middot;</span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground/70">
                {iv.item.pICMS}% &middot; CST {iv.item.cst} &middot; CFOP {iv.item.cfop}
              </span>
              {iv.statusFinal === 'INFO'
                ? <Info size={12} className="text-sky-500" />
                : <CheckCircle2 size={12} className="text-success-500" />
              }
            </span>
          </>
        )}

        {/* Nao-OK: status icons + chevron toggle */}
        {!isOk && (
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <CheckIcon status={aliqStatus} />
            <CheckIcon status={cstStatus} />
            <CheckIcon status={cfopStatus} />
            {expanded
              ? <ChevronDown size={14} className="text-muted-foreground ml-1" />
              : <ChevronRight size={14} className="text-muted-foreground ml-1" />
            }
          </span>
        )}
      </div>

      {/* -- Detalhes expandidos (toggle para itens com problema) -- */}
      {!isOk && expanded && (
        <div className="mt-1.5 ml-3 space-y-1">

          {/* Linha inline de comparacao: Aliquota + CST + CFOP + CP */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <InlineCompare label="" actual={`${iv.item.pICMS}%`} expected={aliqEsperada} status={aliqStatus} />
            <InlineCompare label="CST" actual={`${iv.item.cstOrig} (${iv.item.cst})`} expected={cstOrigEsperado} status={cstStatus} />
            <InlineCompare label="CFOP" actual={iv.item.cfop} expected={cfopEsperado} status={cfopStatus} />
            {hasCP && (
              <span className="text-xs font-mono text-purple-700">
                CP {iv.item.cCredPresumido}
                {iv.item.pCredPresumido > 0 && ` (${iv.item.pCredPresumido}%)`}
                {iv.item.vCredPresumido > 0 && ` = ${fmtBRL(iv.item.vCredPresumido)}`}
              </span>
            )}
          </div>

          {/* Mensagens de erro/alerta - compactas sem border individual */}
          {nonOkResults.length > 0 && (
            <div className="space-y-0.5">
              {nonOkResults.map((r, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-1.5 text-xs',
                    r.status === 'ERRO' && 'text-danger-700',
                    r.status === 'DIVERGENCIA' && 'text-orange-700',
                    r.status === 'AVISO' && 'text-warning-700',
                    r.status === 'INFO' && 'text-sky-700',
                  )}
                >
                  <span className="font-mono font-bold shrink-0">[{r.regra}]</span>
                  <span>{r.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          {/* Acoes recomendadas - inline */}
          {(() => {
            const acoes = nonOkResults.filter(r => r.acao && r.acao.tipo !== 'nenhuma').map(r => r.acao!);
            if (acoes.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1">
                {acoes.map((a, idx) => (
                  <AcaoCard key={idx} acao={a} />
                ))}
              </div>
            );
          })()}

          {/* Cross-checks - inline sem header separado */}
          {iv.crossChecks.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/70">
              <span className="uppercase tracking-wider font-medium">Verificacoes ({iv.item.pICMS}%)</span>
              {iv.crossChecks.map((ck, idx) => (
                <span key={idx} className="inline-flex items-center gap-0.5">
                  <SeverityIcon severity={ck.severity} />
                  <span className={severityLabelColor[ck.severity]}>{ck.label}</span>
                  <span className={cn('font-bold', ck.passed ? 'text-success-600' : 'text-danger-500')}>
                    {ck.passed ? 'SIM' : 'NAO'}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info results inline for OK/INFO items */}
      {isOk && iv.resultados.some(r => r.status === 'INFO') && (
        <div className="mt-1 ml-3 space-y-0.5">
          {iv.resultados.filter(r => r.status === 'INFO').map((r, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[10px] text-sky-600">
              <Info size={10} className="shrink-0 mt-0.5" />
              <span>[{r.regra}] {r.mensagem}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cross-checks para itens OK com verificacoes importantes */}
      {isOk && iv.crossChecks.some(ck => ck.severity !== 'ok') && (
        <div className="mt-1 ml-3 flex flex-wrap gap-x-2 gap-y-0.5">
          {iv.crossChecks.filter(ck => ck.severity !== 'ok').map((ck, idx) => (
            <span key={idx} className="inline-flex items-center gap-0.5 text-xs">
              <SeverityIcon severity={ck.severity} />
              <span className={severityLabelColor[ck.severity]}>{ck.label}</span>
              <span className={cn('font-bold ml-0.5', ck.passed ? 'text-success-600' : 'text-danger-500')}>
                {ck.passed ? 'SIM' : 'NAO'}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
