import { useMemo, useState } from 'react';
import type { NfeValidation } from '../types/validation.ts';
import type { RegrasConfig } from '../types/regras.ts';
import type { AppConfig } from '../types/config.ts';
import { buildReconciliacao } from '../engine/reconciliacao.ts';
import { buildApuracaoMensal, confrontarContabilidade, type DadosContabilidade } from '../engine/apuracao.ts';
import { exportPlanilha77 } from '../utils/exportExcel.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { AlertTriangle, CheckCircle2, CircleAlert, Download, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ReconciliacaoPanelProps {
  results: NfeValidation[];
  regras?: RegrasConfig;
  config?: AppConfig;
}

type ContabInput = { icmsDebitado: string; icmsCreditado: string; cpApropriado: string; fundosRecolhidos: string };
const EMPTY_CONTAB: ContabInput = { icmsDebitado: '', icmsCreditado: '', cpApropriado: '', fundosRecolhidos: '' };

function parseNumeric(s: string): number {
  if (!s.trim()) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function ReconciliacaoPanel({ results, regras, config }: ReconciliacaoPanelProps) {
  const reconciliacao = useMemo(() => buildReconciliacao(results, regras, config), [results, regras, config]);
  const apuracao = useMemo(() => buildApuracaoMensal(results, regras, config), [results, regras, config]);

  const [contab, setContab] = useState<ContabInput>(EMPTY_CONTAB);
  const [exporting, setExporting] = useState(false);
  const hasContab = Object.values(contab).some(v => v.trim() !== '');
  const dadosContab: DadosContabilidade = {
    icmsDebitado: parseNumeric(contab.icmsDebitado),
    icmsCreditado: parseNumeric(contab.icmsCreditado),
    cpApropriado: parseNumeric(contab.cpApropriado),
    fundosRecolhidos: parseNumeric(contab.fundosRecolhidos),
  };
  const confrontacao = useMemo(
    () => (hasContab ? confrontarContabilidade(apuracao, dadosContab) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasContab, apuracao, contab],
  );

  async function handleExportPlanilha77() {
    setExporting(true);
    try {
      const r = regras ?? getDefaultRegras();
      // Se config nao foi fornecido, usa um objeto minimo compativel.
      const c = config ?? {
        decreto2128: [],
        listaCamex: [],
        listaCobreAco: [],
        listaSN: [],
        listaIndustriais: [],
        listaCD: [],
        listaVedacao25a: [],
        listaVedacao25b: [],
        ufAliquotas: {},
        aliquotasInternasValidas: [],
      };
      await exportPlanilha77(results, r, c, {
        periodo: apuracao.periodo || undefined,
        contabilidade: hasContab ? dadosContab : undefined,
        confrontacao: confrontacao ?? undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  if (results.length === 0) return null;

  const {
    porTTD, porCP,
    totalGeralBC, totalGeralICMSRecolher, totalGeralFundos, totalGeralRecolherComFundos,
    totalGeralICMSRecolher21, totalGeralRecolherComFundos21, temCAMEX,
  } = reconciliacao;

  return (
    <div className="space-y-4">
      {/* TTD table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reconciliacao DIME — por Regime TTD</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[800px] text-xs">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ref TTD</TableHead>
                  <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cenarios</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Itens</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">NF-es</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">BC ICMS</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ICMS Dest.</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Carga %</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ICMS Recolher</TableHead>
                  {temCAMEX && (
                    <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-amber-700 uppercase tracking-wider" title="Alternativa CAMEX 2,1%">Recolher 2,1%</TableHead>
                  )}
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fundos</TableHead>
                  <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</TableHead>
                  {temCAMEX && (
                    <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-amber-700 uppercase tracking-wider" title="Total com CAMEX 2,1%">Total 2,1%</TableHead>
                  )}
                  <TableHead className="text-center px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {porTTD.map((t) => (
                  <TableRow key={t.refTTD} className={cn('hover:bg-muted/60 transition-colors', t.temDivergencia && 'bg-orange-50/40')}>
                    <TableCell className="px-3 py-2 font-mono font-semibold text-foreground">{t.refTTD}</TableCell>
                    <TableCell className="px-3 py-2 text-muted-foreground">{t.cenarios.join(', ')}</TableCell>
                    <TableCell className="px-3 py-2 text-right text-muted-foreground">{t.qtdItens}</TableCell>
                    <TableCell className="px-3 py-2 text-right text-muted-foreground">{t.qtdNfes}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(t.totalBC)}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(t.totalICMSDestacado)}</TableCell>
                    <TableCell className="px-3 py-2 text-right text-muted-foreground">{t.cargaEfetiva < 0 ? 'N/A' : t.cargaEfetiva > 0 ? `${t.cargaEfetiva}%` : '-'}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-primary">{formatCurrency(t.totalICMSRecolher)}</TableCell>
                    {temCAMEX && (
                      <TableCell className={cn('px-3 py-2 text-right font-mono tabular-nums', t.temCAMEX ? 'text-amber-700' : 'text-muted-foreground/50')}>
                        {t.temCAMEX ? formatCurrency(t.totalICMSRecolher21) : '—'}
                      </TableCell>
                    )}
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(t.totalFundos)}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{formatCurrency(t.totalRecolherComFundos)}</TableCell>
                    {temCAMEX && (
                      <TableCell className={cn('px-3 py-2 text-right font-mono tabular-nums font-semibold', t.temCAMEX ? 'text-amber-700' : 'text-muted-foreground/50')}>
                        {t.temCAMEX ? formatCurrency(t.totalRecolherComFundos21) : '—'}
                      </TableCell>
                    )}
                    <TableCell className="px-3 py-2 text-center">
                      {t.temDivergencia && (
                        <AlertTriangle size={14} className="text-orange-500 inline-block" title="Itens com divergencia neste regime" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted font-semibold border-t-2 border-border">
                  <TableCell className="px-3 py-2" colSpan={4}>Total</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(totalGeralBC)}</TableCell>
                  <TableCell className="px-3 py-2" />
                  <TableCell className="px-3 py-2" />
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-primary">{formatCurrency(totalGeralICMSRecolher)}</TableCell>
                  {temCAMEX && (
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-amber-700">{formatCurrency(totalGeralICMSRecolher21)}</TableCell>
                  )}
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(totalGeralFundos)}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(totalGeralRecolherComFundos)}</TableCell>
                  {temCAMEX && (
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-amber-700">{formatCurrency(totalGeralRecolherComFundos21)}</TableCell>
                  )}
                  <TableCell className="px-3 py-2" />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confrontação Contábil */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Confrontação Contábil</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleExportPlanilha77()}
            disabled={exporting}
            aria-label="Exportar planilha 7.7 / 7.8"
          >
            <Download size={14} aria-hidden />
            {exporting ? 'Gerando...' : 'Planilha 7.7/7.8'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Informe os valores da contabilidade/DIME do período para comparar com a apuração do sistema.
            Os campos aceitam apenas números (ponto ou vírgula como separador decimal).
            O botão acima gera as abas 7.7 (Controle CP), 7.8 (Fundos), Resumo Mensal e, se a contabilidade estiver preenchida, a aba de Confrontação.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">ICMS Debitado</label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={contab.icmsDebitado}
                onChange={e => setContab({ ...contab, icmsDebitado: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">ICMS Creditado</label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={contab.icmsCreditado}
                onChange={e => setContab({ ...contab, icmsCreditado: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">CP Apropriado</label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={contab.cpApropriado}
                onChange={e => setContab({ ...contab, cpApropriado: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fundos Recolhidos</label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={contab.fundosRecolhidos}
                onChange={e => setContab({ ...contab, fundosRecolhidos: e.target.value })}
              />
            </div>
          </div>

          {confrontacao && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rubrica</TableHead>
                      <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Apurado (sistema)</TableHead>
                      <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contabilidade</TableHead>
                      <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    <TableRow>
                      <TableCell className="px-3 py-2 font-medium">ICMS (líquido)</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.liquidoICMSRecolher)}</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(dadosContab.icmsDebitado - dadosContab.icmsCreditado)}</TableCell>
                      <TableCell className={cn('px-3 py-2 text-right font-mono tabular-nums font-semibold', Math.abs(confrontacao.diffICMS) < 0.01 ? 'text-muted-foreground' : confrontacao.diffICMS > 0 ? 'text-amber-700' : 'text-red-700')}>
                        {formatCurrency(confrontacao.diffICMS)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-3 py-2 font-medium">Crédito Presumido</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.totalCPApropriado)}</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(dadosContab.cpApropriado)}</TableCell>
                      <TableCell className={cn('px-3 py-2 text-right font-mono tabular-nums font-semibold', Math.abs(confrontacao.diffCP) < 0.01 ? 'text-muted-foreground' : confrontacao.diffCP > 0 ? 'text-amber-700' : 'text-red-700')}>
                        {formatCurrency(confrontacao.diffCP)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-3 py-2 font-medium">Fundos</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.liquidoFundos)}</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(dadosContab.fundosRecolhidos)}</TableCell>
                      <TableCell className={cn('px-3 py-2 text-right font-mono tabular-nums font-semibold', Math.abs(confrontacao.diffFundos) < 0.01 ? 'text-muted-foreground' : confrontacao.diffFundos > 0 ? 'text-amber-700' : 'text-red-700')}>
                        {formatCurrency(confrontacao.diffFundos)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-start gap-3">
                {confrontacao.status === 'ok' && (
                  <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
                    <CheckCircle2 size={12} /> Convergente
                  </Badge>
                )}
                {confrontacao.status === 'atencao' && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
                    <CircleAlert size={12} /> Atenção
                  </Badge>
                )}
                {confrontacao.status === 'divergente' && (
                  <Badge className="bg-red-100 text-red-800 border-red-300 gap-1">
                    <XCircle size={12} /> Divergente
                  </Badge>
                )}
                <ul className="flex-1 text-xs text-muted-foreground space-y-1">
                  {confrontacao.observacoes.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CP table */}
      {porCP.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credito Presumido — por Codigo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted">
                    <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Codigo CP</TableHead>
                    <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Qtd Itens</TableHead>
                    <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">BC ICMS</TableHead>
                    <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Credito</TableHead>
                    <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">% Medio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {porCP.map((cp) => (
                    <TableRow key={cp.codigoCP} className="hover:bg-muted/60 transition-colors">
                      <TableCell className="px-3 py-2 font-mono font-semibold text-purple-700">{cp.codigoCP}</TableCell>
                      <TableCell className="px-3 py-2 text-right text-muted-foreground">{cp.qtdItens}</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(cp.totalBC)}</TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-purple-700">{formatCurrency(cp.totalCredito)}</TableCell>
                      <TableCell className="px-3 py-2 text-right text-muted-foreground">{cp.percentualMedio.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
