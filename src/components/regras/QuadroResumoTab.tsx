import { useMemo } from 'react';
import type { RegrasConfig, CondicoesCenario } from '../../types/regras.ts';
import { mergeValores } from '../../types/regras.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Tipos ──────────────────────────────────────────────────────

interface CenarioFlat {
  cenarioId: string;
  grupoId: string;
  nome: string;
  secao: 'interestadual' | 'interna' | 'outro';
  destinatario: string;
  camex: string;
  tipo: string;
  cargaEfetiva: number;
  aliquotas: number[];
  creditoPresumido: boolean;
  refTTD: string;
  descricao: string;
  ativo: boolean;
  prioridade: number;
}

// ── Labels ─────────────────────────────────────────────────────

const TIPO_DEST_LABELS: Record<string, string> = {
  contribuinte: 'Contribuinte',
  sn: 'Simples Nacional',
  pf: 'Pessoa Física',
  pj_nc: 'PJ Não Contribuinte',
  desconhecido: 'Desconhecido',
};

function formatDestinatario(tipoDest?: string[]): string {
  if (!tipoDest || tipoDest.length === 0) return '—';
  return tipoDest.map(t => TIPO_DEST_LABELS[t] || t).join(' / ');
}

function formatCamex(condicoes: CondicoesCenario, extra?: Partial<CondicoesCenario>): string {
  const val = extra?.camex ?? condicoes.camex;
  if (val === true) return 'Sim';
  if (val === false) return 'Não';
  return '—';
}

function derivarTipo(condicoes: CondicoesCenario, extra?: Partial<CondicoesCenario>): string {
  const lista = extra?.listaEspecial ?? condicoes.listaEspecial;
  const cfop = extra?.cfopMatch ?? condicoes.cfopMatch;
  const cobreAco = extra?.cobreAco ?? condicoes.cobreAco;
  const temST = extra?.temST ?? condicoes.temST;

  if (lista === 'industrial') return 'Industrial';
  if (lista === 'vedacao25a') return 'Vedação 25a';
  if (lista === 'vedacao25b') return 'Vedação 25b';
  if (lista === 'cd') return 'CD Exclusivo';
  if (cfop === 'transferencia') return 'Transferência';
  if (cfop === 'devolucao') return 'Devolução';
  if (cobreAco === true) return 'Cobre/Aço';
  if (temST === true) return 'Com ST';
  if (temST === false) return 'Sem ST';
  // If CAMEX is the differentiator at extra level, label as CAMEX variant
  if (extra?.camex === true && condicoes.camex === undefined) return 'CAMEX';
  return 'Geral';
}

function formatAliquotas(aliquotas: number[]): string {
  if (aliquotas.length === 0) return 'dif.';
  return aliquotas.map(a => `${a}%`).join(' / ');
}

function formatCarga(carga: number): string {
  if (carga < 0) return 'N/A';
  if (carga === 0) return '—';
  return `${carga.toFixed(2).replace('.', ',')}%`;
}

// ── Flatten ────────────────────────────────────────────────────

function flattenCenarios(regras: RegrasConfig): CenarioFlat[] {
  const result: CenarioFlat[] = [];

  const sorted = [...regras.grupos].sort((a, b) => a.prioridade - b.prioridade);

  for (const grupo of sorted) {
    const rams = [...grupo.ramificacoes].sort((a, b) => a.prioridade - b.prioridade);

    for (const ram of rams) {
      const valores = mergeValores(grupo.valoresBase, ram.override);
      const secao = grupo.condicoes.operacao === 'interestadual' ? 'interestadual'
        : grupo.condicoes.operacao === 'interna' ? 'interna'
        : 'outro';

      result.push({
        cenarioId: ram.cenarioId,
        grupoId: grupo.id,
        nome: ram.nome,
        secao,
        destinatario: formatDestinatario(grupo.condicoes.tipoDest),
        camex: formatCamex(grupo.condicoes, ram.condicaoExtra),
        tipo: derivarTipo(grupo.condicoes, ram.condicaoExtra),
        cargaEfetiva: valores.cargaEfetiva,
        aliquotas: valores.aliquotasAceitas,
        creditoPresumido: valores.temCP,
        refTTD: valores.refTTD || '—',
        descricao: grupo.descricao,
        ativo: grupo.ativo,
        prioridade: grupo.prioridade,
      });
    }
  }

  return result;
}

// ── Componente ─────────────────────────────────────────────────

interface QuadroResumoTabProps {
  regras: RegrasConfig;
  onNavigateToGrupo?: (grupoId: string) => void;
}

const SECAO_LABELS: Record<string, string> = {
  interestadual: 'SAÍDAS INTERESTADUAIS',
  interna: 'SAÍDAS INTERNAS (SC)',
  outro: 'OUTROS',
};

const SECAO_ORDER = ['interestadual', 'interna', 'outro'];

export function QuadroResumoTab({ regras, onNavigateToGrupo }: QuadroResumoTabProps) {
  const flat = useMemo(() => flattenCenarios(regras), [regras]);

  // Group by section
  const sections = useMemo(() => {
    const map = new Map<string, CenarioFlat[]>();
    for (const c of flat) {
      const arr = map.get(c.secao) || [];
      arr.push(c);
      map.set(c.secao, arr);
    }
    return SECAO_ORDER
      .filter(s => map.has(s))
      .map(s => ({ key: s, label: SECAO_LABELS[s] || s, cenarios: map.get(s)! }));
  }, [flat]);

  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.key}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-1">
            {section.label}
          </h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[70px] text-xs">Cenário</TableHead>
                  <TableHead className="text-xs">Destinatário</TableHead>
                  <TableHead className="w-[60px] text-xs text-center">CAMEX</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="w-[90px] text-xs text-right">Carga Efetiva</TableHead>
                  <TableHead className="w-[110px] text-xs text-right">Alíquota</TableHead>
                  <TableHead className="w-[40px] text-xs text-center">CP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.cenarios.map(c => (
                  <TableRow
                    key={c.cenarioId}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-accent/50',
                      !c.ativo && 'opacity-40',
                    )}
                    onClick={() => onNavigateToGrupo?.(c.grupoId)}
                    title={c.descricao || c.nome}
                  >
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="font-mono text-[11px] px-1.5">
                        {c.cenarioId}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">{c.destinatario}</TableCell>
                    <TableCell className="py-1.5 text-xs text-center">
                      {c.camex === 'Sim' ? (
                        <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1">Sim</Badge>
                      ) : c.camex === 'Não' ? (
                        <span className="text-muted-foreground">Não</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">{c.tipo}</TableCell>
                    <TableCell className="py-1.5 text-xs text-right font-mono">
                      {formatCarga(c.cargaEfetiva)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-right font-mono">
                      {formatAliquotas(c.aliquotas)}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {c.creditoPresumido ? (
                        <span className="text-green-600 text-xs font-semibold">✓</span>
                      ) : (
                        <span className="text-red-400 text-xs">✗</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      <p className="text-[10px] text-muted-foreground px-1">
        Clique em uma linha para editar o cenário. Cenários inativos aparecem com opacidade reduzida.
      </p>
    </div>
  );
}
