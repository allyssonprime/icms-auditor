import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, AlertTriangle, XCircle, FileSearch, Upload } from 'lucide-react';
import { DropZone } from './DropZone';
import { formatCurrency } from '@/utils/formatters';
import type { CrossValidationResult, NfCrossMatch, MatchStatus } from '@/types/crossValidation';
import type { EfdData } from '@/types/efd';
import type { NfeData } from '@/types/nfe';

interface CrossValidationPanelProps {
  crossValidation: CrossValidationResult | null;
  efdData: EfdData | null;
  efdParseError: string | null;
  rawNfes: NfeData[];
  onFiles: (files: File[]) => void;
  isProcessing: boolean;
}

const STATUS_CONFIG: Record<MatchStatus, { label: string; color: string; bg: string }> = {
  matched: { label: 'OK', color: 'text-green-700', bg: 'bg-green-50' },
  value_divergent: { label: 'Divergente', color: 'text-amber-700', bg: 'bg-amber-50' },
  only_xml: { label: 'Só XML', color: 'text-red-700', bg: 'bg-red-50' },
  only_efd: { label: 'Só EFD', color: 'text-blue-700', bg: 'bg-blue-50' },
};

function StatusBadge({ status }: { status: MatchStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>;
}

export function CrossValidationPanel({ crossValidation, efdData, efdParseError, rawNfes, onFiles, isProcessing }: CrossValidationPanelProps) {
  const [filterStatus, setFilterStatus] = useState<MatchStatus | 'all'>('all');

  const filteredMatches = useMemo(() => {
    if (!crossValidation) return [];
    if (filterStatus === 'all') return crossValidation.matches;
    return crossValidation.matches.filter(m => m.matchStatus === filterStatus);
  }, [crossValidation, filterStatus]);

  // Empty state: no EFD uploaded
  if (!efdData && !crossValidation) {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">Validacao EFD</h2>
          <p className="text-muted-foreground mt-1 text-sm">Validacao cruzada entre XMLs de NF-e e EFD/SPED Fiscal.</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <FileSearch size={28} className="text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Nenhum arquivo EFD carregado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Faca upload do arquivo EFD/SPED Fiscal (.txt) para validacao cruzada com os XMLs.
                </p>
              </div>
              <div className="w-full max-w-lg mt-2">
                <DropZone onFiles={onFiles} isProcessing={isProcessing} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // EFD parsed but no XMLs yet
  if (efdData && rawNfes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">Validacao EFD</h2>
          <p className="text-muted-foreground mt-1 text-sm">Validacao cruzada entre XMLs de NF-e e EFD/SPED Fiscal.</p>
        </div>

        <EfdSummaryCard efdData={efdData} />

        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Upload size={24} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                EFD carregado. Faca upload dos XMLs de NF-e na aba Auditor para gerar a validacao cruzada.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // EFD parse error
  if (efdParseError) {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">Validacao EFD</h2>
        </div>
        <Card className="border-red-200">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <XCircle size={20} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-700">Erro ao processar EFD</p>
                <p className="text-sm text-red-600 mt-1">{efdParseError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!crossValidation) return null;

  const cv = crossValidation;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">Validacao EFD</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Competencia {cv.competencia} — Validacao cruzada XMLs x EFD/SPED Fiscal
          </p>
        </div>
        <Badge variant={cv.isConsistent ? 'default' : 'destructive'} className="text-sm px-3 py-1">
          {cv.isConsistent ? (
            <><CheckCircle2 size={14} className="mr-1" /> Convergente</>
          ) : (
            <><AlertTriangle size={14} className="mr-1" /> Divergencias</>
          )}
        </Badge>
      </div>

      {/* EFD Info */}
      {efdData && <EfdSummaryCard efdData={efdData} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="NFs XML" value={cv.totalXml} />
        <SummaryCard label="NFs EFD (saidas)" value={cv.totalEfd} />
        <SummaryCard label="Em ambos" value={cv.matched} color="green" />
        <SummaryCard label="Divergentes" value={cv.valueDivergent} color={cv.valueDivergent > 0 ? 'amber' : 'green'} />
        <SummaryCard label="So XML" value={cv.onlyXml} color={cv.onlyXml > 0 ? 'red' : 'green'} />
        <SummaryCard label="So EFD" value={cv.onlyEfd} color={cv.onlyEfd > 0 ? 'blue' : 'green'} />
      </div>

      {/* Totals Comparison */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">Comparacao de Totais</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Debitos XML (soma vICMS)</p>
              <p className="font-semibold">{formatCurrency(cv.xmlTotalDebitos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Debitos EFD (E110)</p>
              <p className="font-semibold">{formatCurrency(cv.efdTotalDebitos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Diferenca</p>
              <p className={`font-semibold ${cv.diffTotalDebitos > 1 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatCurrency(cv.diffTotalDebitos)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([['all', 'Todos', cv.matches.length], ['matched', 'OK', cv.matched], ['value_divergent', 'Divergentes', cv.valueDivergent], ['only_xml', 'So XML', cv.onlyXml], ['only_efd', 'So EFD', cv.onlyEfd]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-container text-muted-foreground hover:bg-surface-container-high'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Matches Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">NF</TableHead>
                  <TableHead className="w-16">Serie</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="text-right">BC XML</TableHead>
                  <TableHead className="text-right">BC EFD</TableHead>
                  <TableHead className="text-right">ICMS XML</TableHead>
                  <TableHead className="text-right">ICMS EFD</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma NF encontrada com este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMatches.map((m, i) => <MatchRow key={`${m.numDoc}_${m.serie}_${i}`} match={m} />)
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MatchRow({ match: m }: { match: NfCrossMatch }) {
  const cfg = STATUS_CONFIG[m.matchStatus];
  return (
    <TableRow className={cfg.bg}>
      <TableCell className="font-mono text-xs">{m.numDoc}</TableCell>
      <TableCell className="text-xs">{m.serie}</TableCell>
      <TableCell><StatusBadge status={m.matchStatus} /></TableCell>
      <TableCell className="text-right text-xs font-mono">{m.xmlVlBcIcms !== undefined ? formatCurrency(m.xmlVlBcIcms) : '-'}</TableCell>
      <TableCell className="text-right text-xs font-mono">{m.efdVlBcIcms !== undefined ? formatCurrency(m.efdVlBcIcms) : '-'}</TableCell>
      <TableCell className="text-right text-xs font-mono">{m.xmlVlIcms !== undefined ? formatCurrency(m.xmlVlIcms) : '-'}</TableCell>
      <TableCell className="text-right text-xs font-mono">{m.efdVlIcms !== undefined ? formatCurrency(m.efdVlIcms) : '-'}</TableCell>
      <TableCell>
        {m.flagDivergences.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {m.flagDivergences.map(f => (
              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">{f}</span>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color ? colorMap[color] ?? '' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EfdSummaryCard({ efdData }: { efdData: EfdData }) {
  const { company, stats, e110 } = efdData;
  return (
    <Card className="border-blue-200/50 bg-blue-50/30">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <div><span className="text-muted-foreground">Empresa:</span> <span className="font-medium">{company.nome}</span></div>
          <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-mono">{company.cnpj}</span></div>
          <div><span className="text-muted-foreground">Competencia:</span> <span className="font-medium">{company.competencia}</span></div>
          <div><span className="text-muted-foreground">C100:</span> {stats.totalC100} ({stats.c100Saidas} saidas, {stats.c100Entradas} entradas)</div>
          <div><span className="text-muted-foreground">Cancelados:</span> {stats.c100Cancelados}</div>
          <div><span className="text-muted-foreground">Com TTD:</span> {stats.c110ComTtd}</div>
          <div><span className="text-muted-foreground">C113 refs:</span> {stats.c113Count}</div>
          {e110 && <div><span className="text-muted-foreground">E110 Debitos:</span> <span className="font-mono">{formatCurrency(e110.vlTotDebitos)}</span></div>}
        </div>
      </CardContent>
    </Card>
  );
}
