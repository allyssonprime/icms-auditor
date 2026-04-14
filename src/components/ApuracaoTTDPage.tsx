import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, Tag, Loader2,
  CheckCircle2, FileSpreadsheet,
} from 'lucide-react';
import type { NfeValidation } from '../types/validation.ts';
import type { RegrasConfig } from '../types/regras.ts';
import type { AppConfig } from '../types/config.ts';
import {
  buildApuracaoTTD,
  emptyOverrideMap,
  type ApuracaoTTDResult,
  type ApuracaoCargaBlock,
  type ApuracaoOperacaoBlock,
  type ApuracaoSubgrupo,
  type ApuracaoLinha,
  type CamexOverrideMap,
} from '../engine/apuracaoTTD.ts';
import { extrairPeriodo } from '../engine/apuracao.ts';
import {
  loadCamexOverrides,
  setCamexOverrideByChave,
  setCamexOverrideByPar,
  deleteCamexOverrideByChave,
  applyOverrideToMap,
  removeOverrideFromMap,
  camexParKey,
} from '../firebase/camexOverrideService.ts';
import { exportApuracaoTTD } from '../utils/exportExcel.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ApuracaoTTDPageProps {
  results: NfeValidation[];
  regras?: RegrasConfig;
  config: AppConfig;
}

type Selecao = { chaveAcesso: string; cnpjDest: string; ncms: string[] };

export function ApuracaoTTDPage({ results, regras, config }: ApuracaoTTDPageProps) {
  // --- Estado ---
  const [overrides, setOverrides] = useState<CamexOverrideMap>(emptyOverrideMap());
  const [overridesLoading, setOverridesLoading] = useState(true);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selecionadas, setSelecionadas] = useState<Map<string, Selecao>>(new Map());
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  // --- Carrega overrides ao montar ---
  useEffect(() => {
    let cancelled = false;
    setOverridesLoading(true);
    loadCamexOverrides()
      .then(map => {
        if (!cancelled) setOverrides(map);
      })
      .finally(() => {
        if (!cancelled) setOverridesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Períodos disponíveis ---
  const periodosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const nv of results) {
      const p = extrairPeriodo(nv.nfe.dhEmi);
      if (p) set.add(p);
    }
    return Array.from(set).sort().reverse();
  }, [results]);

  // Inicializa período com o primeiro disponível
  useEffect(() => {
    if (!periodoSelecionado && periodosDisponiveis.length > 0) {
      setPeriodoSelecionado(periodosDisponiveis[0]!);
    }
  }, [periodosDisponiveis, periodoSelecionado]);

  // --- Apuração ---
  const apuracao: ApuracaoTTDResult = useMemo(() => {
    if (results.length === 0) {
      return {
        periodo: '',
        cargas: [],
        totalBCGlobal: 0,
        totalVICMSGlobal: 0,
        totalCPGlobal: 0,
        fundos: { fundec: 0, fumdes: 0, proEmprego: 0, fundoSocial: 0 },
      };
    }
    return buildApuracaoTTD(
      results,
      regras,
      config,
      overrides,
      periodoSelecionado || undefined,
    );
  }, [results, regras, config, overrides, periodoSelecionado]);

  // --- Helpers ---
  const isExpanded = (key: string) => expanded.has(key);
  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelecao = (linha: ApuracaoLinha) => {
    setSelecionadas(prev => {
      const next = new Map(prev);
      if (next.has(linha.chaveAcesso)) next.delete(linha.chaveAcesso);
      else next.set(linha.chaveAcesso, {
        chaveAcesso: linha.chaveAcesso,
        cnpjDest: linha.cnpjDest,
        ncms: linha.ncms,
      });
      return next;
    });
  };

  const limparSelecao = () => setSelecionadas(new Map());

  const aplicarReclassificacao = async (
    novaCarga: 2.1 | 3.6,
    modo: 'apenas_nf' | 'cnpj_ncm',
  ) => {
    setSalvando(true);
    setFeedback(null);
    try {
      let mapAtualizado = overrides;
      for (const sel of selecionadas.values()) {
        if (modo === 'apenas_nf') {
          await setCamexOverrideByChave(sel.chaveAcesso, novaCarga);
          mapAtualizado = applyOverrideToMap(mapAtualizado, 'chave', sel.chaveAcesso, {
            carga: novaCarga,
            origem: 'manual_nf',
          });
        } else {
          // Aplicar override por par para cada NCM da seleção
          if (!sel.cnpjDest) continue;
          for (const ncm of sel.ncms) {
            await setCamexOverrideByPar(sel.cnpjDest, ncm, novaCarga);
            mapAtualizado = applyOverrideToMap(
              mapAtualizado,
              'par',
              camexParKey(sel.cnpjDest, ncm),
              { carga: novaCarga, origem: 'manual_par' },
            );
          }
        }
      }
      setOverrides(mapAtualizado);
      setFeedback(`${selecionadas.size} NF(s) reclassificada(s) para ${formatPct(novaCarga)}.`);
      limparSelecao();
    } catch (err) {
      console.error(err);
      setFeedback('Erro ao salvar reclassificacao. Veja o console.');
    } finally {
      setSalvando(false);
    }
  };

  const removerOverrideNF = async (chaveAcesso: string) => {
    setSalvando(true);
    try {
      await deleteCamexOverrideByChave(chaveAcesso);
      setOverrides(prev => removeOverrideFromMap(prev, 'chave', chaveAcesso));
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExport = async () => {
    setExportando(true);
    try {
      await exportApuracaoTTD(apuracao);
    } catch (err) {
      console.error('[exportApuracaoTTD] erro:', err);
      setFeedback('Erro ao exportar Excel. Veja o console.');
    } finally {
      setExportando(false);
    }
  };

  // --- Render ---
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Importe NF-es no Auditor para visualizar a apuracao TTD.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-heading text-foreground">Apuracao TTD</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Espelha o "Relatorio da Apuracao dos Creditos por Regime Especial" da contabilidade
          </p>
        </div>
        <div className="flex items-center gap-3">
          {periodosDisponiveis.length > 0 && (
            <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                {periodosDisponiveis.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleExport} disabled={exportando} className="gap-2">
            {exportando
              ? <Loader2 size={14} className="animate-spin" />
              : <FileSpreadsheet size={14} />}
            Exportar Excel
          </Button>
        </div>
      </div>

      {overridesLoading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Carregando overrides CAMEX...
        </div>
      )}

      {feedback && (
        <div className="text-xs px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={14} /> {feedback}
        </div>
      )}

      {/* Barra de seleção */}
      {selecionadas.size > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selecionadas.size} NF(s) selecionada(s) — reclassificar para:</span>
            <Button
              size="sm" variant="outline" disabled={salvando}
              onClick={() => aplicarReclassificacao(2.1, 'apenas_nf')}
            >
              2,10% (apenas estas NFs)
            </Button>
            <Button
              size="sm" variant="outline" disabled={salvando}
              onClick={() => aplicarReclassificacao(3.6, 'apenas_nf')}
            >
              3,60% (apenas estas NFs)
            </Button>
            <Button
              size="sm" variant="outline" disabled={salvando}
              onClick={() => aplicarReclassificacao(2.1, 'cnpj_ncm')}
            >
              2,10% (todas NFs do mesmo CNPJ+NCM)
            </Button>
            <Button
              size="sm" variant="outline" disabled={salvando}
              onClick={() => aplicarReclassificacao(3.6, 'cnpj_ncm')}
            >
              3,60% (todas NFs do mesmo CNPJ+NCM)
            </Button>
            <Button size="sm" variant="ghost" onClick={limparSelecao}>Limpar</Button>
            {salvando && <Loader2 size={14} className="animate-spin" />}
          </CardContent>
        </Card>
      )}

      {/* Cargas */}
      {apuracao.cargas
        .filter(c => c.totalBC > 0)
        .map(carga => (
          <CargaCard
            key={`${carga.carga}_${carga.isCAMEX ? 'C' : 'N'}`}
            carga={carga}
            isExpanded={isExpanded}
            toggleExpand={toggleExpand}
            selecionadas={selecionadas}
            toggleSelecao={toggleSelecao}
            removerOverrideNF={removerOverrideNF}
          />
        ))}

      {/* Débitos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Debitos com beneficio fiscal — TTD 410</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="px-3 py-2">Carga / Aliquota</TableHead>
                <TableHead className="px-3 py-2 text-right">ICMS Destacado</TableHead>
                <TableHead className="px-3 py-2 text-right">ICMS a Recolher</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apuracao.cargas.filter(c => c.totalVICMS > 0).map(c => {
                const recolher = Math.round(c.totalBC * c.carga) / 100;
                return (
                  <TableRow key={`${c.carga}_${c.isCAMEX ? 'C' : 'N'}`}>
                    <TableCell className="px-3 py-2">
                      Carga {formatPct(c.carga)} — {c.aliquotaLabel}
                      {c.isCAMEX && (
                        <Badge variant="outline" className="ml-2 text-[10px] bg-amber-50 border-amber-300 text-amber-700">CAMEX</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(c.totalVICMS)}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(recolher)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted font-semibold">
                <TableCell className="px-3 py-2">Total debitos com beneficio</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.totalVICMSGlobal)}</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatCurrency(apuracao.cargas.reduce((s, c) => s + Math.round(c.totalBC * c.carga) / 100, 0))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Fundos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fundos sociais (sobre BC integral total = {formatCurrency(apuracao.totalBCGlobal)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="text-sm">
            <TableBody>
              <TableRow>
                <TableCell className="px-3 py-2">FUNDEC</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground text-xs">0,05% × BC (isento)</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-3 py-2">FUMDES</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground text-xs">2,00% × CP total ({formatCurrency(apuracao.totalCPGlobal)})</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.fundos.fumdes)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-3 py-2">Pro-Emprego</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground text-xs">2,50% × BC − deducoes</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.fundos.proEmprego)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="px-3 py-2">Fundo Social</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground text-xs">0,40% × BC − FUMDES</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.fundos.fundoSocial)}</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted font-semibold">
                <TableCell className="px-3 py-2">Total Fundos</TableCell>
                <TableCell className="px-3 py-2 text-muted-foreground text-xs">FUMDES + Fundo Social</TableCell>
                <TableCell className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(apuracao.fundos.fumdes + apuracao.fundos.fundoSocial)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Subcomponentes ---

interface CargaCardProps {
  carga: ApuracaoCargaBlock;
  isExpanded: (key: string) => boolean;
  toggleExpand: (key: string) => void;
  selecionadas: Map<string, Selecao>;
  toggleSelecao: (linha: ApuracaoLinha) => void;
  removerOverrideNF: (chaveAcesso: string) => void;
}

function CargaCard({ carga, isExpanded, toggleExpand, selecionadas, toggleSelecao, removerOverrideNF }: CargaCardProps) {
  const cargaKey = `carga_${carga.carga}_${carga.isCAMEX ? 'C' : 'N'}`;
  const expanded = isExpanded(cargaKey);

  return (
    <Card className={cn(carga.isCAMEX && 'border-amber-200')}>
      <CardHeader
        className={cn('cursor-pointer transition-colors', carga.isCAMEX ? 'hover:bg-amber-50/40' : 'hover:bg-muted/40')}
        onClick={() => toggleExpand(cargaKey)}
      >
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Carga {formatPct(carga.carga)} — {carga.aliquotaLabel}
            {carga.isCAMEX && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-300 text-amber-700">CAMEX</Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-mono">{carga.refTTDLabel}</Badge>
          </span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            BC {formatCurrency(carga.totalBC)} │ vICMS {formatCurrency(carga.totalVICMS)} │ CP {formatCurrency(carga.totalCP)}
          </span>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {carga.operacoes.map(op => (
            <OperacaoBlock
              key={op.tipo}
              cargaKey={cargaKey}
              op={op}
              isCAMEXBlock={carga.isCAMEX}
              selecionadas={selecionadas}
              toggleSelecao={toggleSelecao}
              removerOverrideNF={removerOverrideNF}
            />
          ))}
          <div className="flex justify-between items-center px-4 py-2.5 bg-foreground/5 rounded-md text-xs font-bold border border-border">
            <span>Total Carga {formatPct(carga.carga)}</span>
            <span className="font-mono tabular-nums space-x-4">
              <span>BC {formatCurrency(carga.totalBC)}</span>
              <span>ICMS {formatCurrency(carga.totalVICMS)}</span>
              <span>CP {formatCurrency(carga.totalCP)}</span>
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface OperacaoBlockProps {
  cargaKey: string;
  op: ApuracaoOperacaoBlock;
  isCAMEXBlock: boolean;
  selecionadas: Map<string, Selecao>;
  toggleSelecao: (linha: ApuracaoLinha) => void;
  removerOverrideNF: (chaveAcesso: string) => void;
}

function OperacaoBlock({ cargaKey, op, isCAMEXBlock, selecionadas, toggleSelecao, removerOverrideNF }: OperacaoBlockProps) {
  const label = op.tipo === 'interna' ? 'Operacao Interna' : 'Operacao Interestadual';
  return (
    <div className="mb-4">
      <div className="text-sm font-semibold text-foreground mb-2">{label}</div>
      {op.subgrupos.map(sg => (
        <SubgrupoTable
          key={`${cargaKey}_${op.tipo}_${sg.reducaoBC}`}
          subgrupo={sg}
          isCAMEXBlock={isCAMEXBlock}
          selecionadas={selecionadas}
          toggleSelecao={toggleSelecao}
          removerOverrideNF={removerOverrideNF}
        />
      ))}
    </div>
  );
}

interface SubgrupoTableProps {
  subgrupo: ApuracaoSubgrupo;
  isCAMEXBlock: boolean;
  selecionadas: Map<string, Selecao>;
  toggleSelecao: (linha: ApuracaoLinha) => void;
  removerOverrideNF: (chaveAcesso: string) => void;
}

function SubgrupoTable({ subgrupo, isCAMEXBlock, selecionadas, toggleSelecao, removerOverrideNF }: SubgrupoTableProps) {
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 ml-4">
        {subgrupo.reducaoBC === 'sem_reducao' ? 'Sem reducao de BC' : 'Com reducao de BC'}
      </div>
      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="w-8 px-2 py-2"></TableHead>
              <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data</TableHead>
              <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documento</TableHead>
              <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Destinatario</TableHead>
              <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor Contabil</TableHead>
              <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">BC Integral</TableHead>
              <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aliq</TableHead>
              <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">vICMS</TableHead>
              <TableHead className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CP</TableHead>
              <TableHead className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {subgrupo.linhas.map(linha => {
              const isCamexLinha = !!linha.origemCAMEX;
              const isSelected = selecionadas.has(linha.chaveAcesso);
              return (
                <TableRow key={`${linha.chaveAcesso}_${linha.pICMS}`} className={cn('hover:bg-muted/40', isSelected && 'bg-amber-50/60')}>
                  <TableCell className="px-2 py-1.5">
                    {isCAMEXBlock && isCamexLinha && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelecao(linha)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 font-mono">{linha.data}</TableCell>
                  <TableCell className="px-3 py-1.5 font-mono">
                    {linha.numero}
                    {linha.temItensOutrasCargas && (
                      <AlertTriangle
                        size={11}
                        className="inline-block ml-1 text-amber-500"
                      />
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 max-w-[200px] truncate" title={linha.destNome}>{linha.destNome}</TableCell>
                  <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(linha.vNF)}</TableCell>
                  <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(linha.bcIntegral)}</TableCell>
                  <TableCell className="px-3 py-1.5 text-right font-mono">{linha.pICMS}%</TableCell>
                  <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(linha.vICMS)}</TableCell>
                  <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(linha.vCP)}</TableCell>
                  <TableCell className="px-3 py-1.5">
                    {isCamexLinha && (
                      <span className="flex items-center gap-1">
                        <OrigemBadge origem={linha.origemCAMEX!} />
                        {(linha.origemCAMEX === 'manual_nf') && (
                          <button
                            type="button"
                            className="text-[10px] text-muted-foreground underline hover:text-foreground"
                            onClick={() => removerOverrideNF(linha.chaveAcesso)}
                            title="Remover override"
                          >
                            limpar
                          </button>
                        )}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted font-semibold text-[11px]">
              <TableCell className="px-3 py-1.5" colSpan={4}>{subgrupo.reducaoBC === 'sem_reducao' ? 'sem reducao' : 'com reducao de BC'}</TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(subgrupo.linhas.reduce((s, l) => s + l.vNF, 0))}</TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(subgrupo.totalBC)}</TableCell>
              <TableCell className="px-3 py-1.5"></TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(subgrupo.totalVICMS)}</TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono tabular-nums">{formatCurrency(subgrupo.totalCP)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

function OrigemBadge({ origem }: { origem: NonNullable<ApuracaoLinha['origemCAMEX']> }) {
  const map: Record<string, { label: string; cls: string }> = {
    auto_default: { label: 'auto 3,6%', cls: 'bg-slate-100 text-slate-700' },
    auto_industrial: { label: 'auto industrial', cls: 'bg-blue-100 text-blue-700' },
    auto_cnae: { label: 'auto CNAE', cls: 'bg-blue-100 text-blue-700' },
    manual_nf: { label: 'manual NF', cls: 'bg-amber-100 text-amber-800' },
    manual_par: { label: 'manual CNPJ+NCM', cls: 'bg-amber-100 text-amber-800' },
    inherited: { label: 'herdado', cls: 'bg-emerald-100 text-emerald-700' },
  };
  const cfg = map[origem] ?? { label: origem, cls: 'bg-slate-100 text-slate-700' };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1', cfg.cls)}>
      <Tag size={9} />{cfg.label}
    </span>
  );
}

function formatPct(v: number): string {
  return `${v.toFixed(2).replace('.', ',')}%`;
}
