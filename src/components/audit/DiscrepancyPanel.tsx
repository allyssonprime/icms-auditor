import type { ItemValidation, CrossCheckSeverity, NfeValidation, CnpjInfo } from '../../types/validation.ts';
import { getCenarios } from '../../engine/cenarios.ts';
import type { RegrasConfig } from '../../types/regras.ts';
import { formatCNPJ } from '../../utils/formatters.ts';
import { isNaoContribuinte } from '../../engine/aliquota.ts';
import { Check, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscrepancyPanelProps {
  item: ItemValidation | null;
  nfe?: NfeValidation | null;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  regras: RegrasConfig;
}

function SeverityIcon({ severity }: { severity: CrossCheckSeverity }) {
  if (severity === 'ok') return <Check size={11} className="text-green-500" />;
  if (severity === 'atencao') return <AlertTriangle size={11} className="text-amber-500" />;
  return <X size={11} className="text-red-500" />;
}

export function DiscrepancyPanel({ item, nfe, cnpjInfoMap, regras }: DiscrepancyPanelProps) {
  if (!item) {
    return (
      <div className="flex flex-col overflow-hidden">
        <div className="bg-surface-container-low px-4 h-8 flex items-center shrink-0">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Detalhes</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400">
          Selecione um item para ver detalhes
        </div>
      </div>
    );
  }

  const cenario = getCenarios(regras)[item.cenario];
  const cenarioNome = cenario?.nome ?? item.cenario;

  const aliqResult = item.resultados.find(r => r.regra.startsWith('AL'));
  const cstResult = item.resultados.find(r => r.regra.startsWith('CST'));
  const cfopResult = item.resultados.find(r => r.regra.startsWith('CF'));

  const aliqEsperada = cenario ? cenario.aliquotasAceitas.map(a => `${a}%`).join(' / ') : '-';
  const cstOrigEsperado = '1 / 6 / 7';
  const cfopEsperado = cenario ? cenario.cfopsEsperados.join(' / ') : '-';

  const nonOkResults = item.resultados.filter(r => r.status !== 'OK' && r.status !== 'INFO');
  const hasCP = !!item.item.cCredPresumido;
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Compute financial gap if aliquota diverges
  const expectedRate = cenario?.cargaEfetiva ?? 3.6;
  const actualRate = item.item.pICMS;
  const hasRateGap = Math.abs(actualRate - expectedRate) > 0.01 && (aliqResult?.status === 'DIVERGENCIA' || aliqResult?.status === 'ERRO');
  const gap = hasRateGap ? item.item.vBC * Math.abs(expectedRate - actualRate) / 100 : 0;

  // Dest info
  const destCnpj = nfe?.nfe.dest.cnpj;
  const destInfo = destCnpj ? cnpjInfoMap?.get(destCnpj.replace(/\D/g, '')) : undefined;
  const isNC = nfe ? isNaoContribuinte(nfe.nfe.dest) : false;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="bg-surface-container-low px-4 h-8 flex items-center shrink-0">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
          Discrepancia (Item {item.item.nItem})
        </span>
      </div>
      <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-auto text-[11px]">

        {/* Destinatario context */}
        {nfe && (
          <div className="bg-slate-50 rounded p-2 space-y-0.5 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase tracking-wider font-bold">Destinatario</span>
              <div className="flex gap-1">
                {destInfo?.simplesOptante === true && <span className="px-1 py-0 rounded bg-orange-100 text-orange-700 font-bold">SN</span>}
                {destInfo?.isMei === true && <span className="px-1 py-0 rounded bg-purple-100 text-purple-700 font-bold">MEI</span>}
                {destInfo?.isIndustrial && <span className="px-1 py-0 rounded bg-blue-100 text-blue-700 font-bold">Industrial</span>}
                {isNC && <span className="px-1 py-0 rounded bg-slate-200 text-slate-600 font-bold">NC</span>}
              </div>
            </div>
            <div className="font-medium text-foreground">{destInfo?.razaoSocial || nfe.nfe.dest.nome}</div>
            {destCnpj && <div className="font-mono text-slate-500">{formatCNPJ(destCnpj)}</div>}
            {destInfo?.cnaeDescricao && <div className="text-slate-400 truncate" title={destInfo.cnaeDescricao}>{destInfo.cnaePrincipal} - {destInfo.cnaeDescricao}</div>}
          </div>
        )}
        {/* Cenario */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Cenario</span>
          <span className="font-bold text-primary">{item.cenario} <span className="font-normal text-slate-500">{cenarioNome}</span></span>
        </div>

        {/* Rate comparison */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Aliquota ICMS</label>
          <div className="flex items-center justify-between py-1 border-b border-dotted border-slate-200">
            <span className="text-slate-600">Esperada ({item.cenario})</span>
            <span className="font-bold tabular-nums text-primary">{aliqEsperada}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Destacada (NF-e)</span>
            <span className={cn('font-bold tabular-nums', aliqResult?.status !== 'OK' ? 'text-red-600' : 'text-green-600')}>{item.item.pICMS}%</span>
          </div>
        </div>

        {/* CST comparison */}
        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">CST Origem</label>
          <div className="flex items-center justify-between py-1 border-b border-dotted border-slate-200">
            <span className="text-slate-600">Esperado</span>
            <span className="font-bold tabular-nums text-primary">{cstOrigEsperado}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Encontrado</span>
            <span className={cn('font-bold tabular-nums', cstResult?.status !== 'OK' && cstResult?.status !== 'INFO' ? 'text-red-600' : 'text-green-600')}>
              {item.item.cstOrig} ({item.item.cst})
            </span>
          </div>
        </div>

        {/* CFOP */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CFOP</span>
          <span className={cn('font-bold tabular-nums', cfopResult?.status !== 'OK' ? 'text-red-600' : 'text-green-600')}>
            {item.item.cfop} <span className="font-normal text-slate-400">esp. {cfopEsperado}</span>
          </span>
        </div>

        {/* CP */}
        {hasCP && (
          <div className="flex items-center justify-between py-1 text-purple-700">
            <span className="text-[9px] font-bold uppercase tracking-widest">Credito Presumido</span>
            <span className="font-bold font-mono">CP {item.item.cCredPresumido} {item.item.pCredPresumido > 0 && `(${item.item.pCredPresumido}%)`} {item.item.vCredPresumido > 0 && `= ${fmtBRL(item.item.vCredPresumido)}`}</span>
          </div>
        )}

        {/* Financial gap */}
        {hasRateGap && gap > 0 && (
          <div className="bg-red-50 p-2 rounded border border-red-100 flex justify-between items-center">
            <span className="text-red-800">Gap Financeiro</span>
            <span className="text-sm font-bold tabular-nums text-red-700">{fmtBRL(gap)}</span>
          </div>
        )}

        {/* Validation messages */}
        {nonOkResults.length > 0 && (
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Validacoes</label>
            <div className="space-y-0.5">
              {nonOkResults.map((r, idx) => (
                <div key={idx} className={cn('text-[10px]', r.status === 'ERRO' ? 'text-red-700' : r.status === 'DIVERGENCIA' ? 'text-orange-700' : 'text-amber-700')}>
                  <span className="font-mono font-bold">[{r.regra}]</span> {r.mensagem}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cross-checks */}
        {item.crossChecks.length > 0 && (
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Verificacoes</label>
            <div className="space-y-0.5">
              {item.crossChecks.map((ck, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1">
                    <SeverityIcon severity={ck.severity} />
                    <span className="text-slate-600">{ck.label}</span>
                  </span>
                  <span className={cn('font-bold', ck.passed ? 'text-green-600' : 'text-red-500')}>
                    {ck.passed ? 'SIM' : 'NAO'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
