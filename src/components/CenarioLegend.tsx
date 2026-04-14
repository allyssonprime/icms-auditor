import { useState, useMemo } from 'react';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { mergeValores, type RegrasConfig, type GrupoRegra, type Ramificacao } from '../types/regras.ts';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CenarioLegendProps {
  regras?: RegrasConfig;
  defaultOpen?: boolean;
}

// --- Tree data structures ---

interface TreeCenario {
  id: string;
  nome: string;
  aliquotas: string;
  carga: string;
  temCP: boolean;
  refTTD: string;
}

interface TreeCategory {
  label: string;
  cenarios: TreeCenario[];
}

interface TreeSection {
  title: string;
  categories: TreeCategory[];
}

// --- Category classification (order = priority) ---
// Exported for reuse in RegrasPage config tree

export const CATEGORIAS: { label: string; test: (g: GrupoRegra) => boolean }[] = [
  { label: 'Transferencia', test: g => g.condicoes.cfopMatch === 'transferencia' },
  { label: 'Cobre/Aco', test: g => !!g.condicoes.cobreAco },
  { label: 'Especiais', test: g => !!g.condicoes.listaEspecial },
  { label: 'Pessoa Fisica', test: g => !!g.condicoes.tipoDest?.includes('pf') },
  { label: 'PJ Nao Contribuinte', test: g => !!g.condicoes.tipoDest?.includes('pj_nc') },
  {
    label: 'Simples Nacional',
    test: g => !!g.condicoes.tipoDest?.includes('sn') && !g.condicoes.tipoDest?.includes('contribuinte'),
  },
  { label: 'Contribuinte / SN', test: g => !!g.condicoes.tipoDest?.includes('contribuinte') },
];

export function classifyGrupo(g: GrupoRegra): string {
  for (const cat of CATEGORIAS) {
    if (cat.test(g)) return cat.label;
  }
  return 'Outros';
}

function formatAliquotas(aliquotas: number[]): string {
  if (aliquotas.length === 0) return 'dif.';
  return aliquotas.map(a => `${a}%`).join('/');
}

function formatCarga(carga: number): string {
  if (carga < 0) return 'N/A';
  if (carga === 0) return '-';
  return `${carga}%`;
}

function ramToCenario(grupo: GrupoRegra, ram: Ramificacao): TreeCenario {
  const valores = mergeValores(grupo.valoresBase, ram.override);
  return {
    id: ram.cenarioId,
    nome: ram.nome,
    aliquotas: formatAliquotas(valores.aliquotasAceitas),
    carga: formatCarga(valores.cargaEfetiva),
    temCP: valores.temCP,
    refTTD: valores.refTTD || '-',
  };
}

function buildTree(regras: RegrasConfig): TreeSection[] {
  const grupos = [...regras.grupos].filter(g => g.ativo).sort((a, b) => a.prioridade - b.prioridade);

  const sections: { key: string; title: string; grupos: GrupoRegra[] }[] = [
    { key: 'interestadual', title: 'Interestadual', grupos: grupos.filter(g => g.condicoes.operacao === 'interestadual') },
    { key: 'interna', title: 'Interna (SC)', grupos: grupos.filter(g => g.condicoes.operacao === 'interna') },
  ];

  // Groups without operacao go into "Outros"
  const other = grupos.filter(g => !g.condicoes.operacao);
  if (other.length > 0) {
    sections.push({ key: 'outros', title: 'Outros', grupos: other });
  }

  return sections
    .filter(s => s.grupos.length > 0)
    .map(section => {
      // Group by category, preserving category order
      const catMap = new Map<string, TreeCenario[]>();

      for (const grupo of section.grupos) {
        const catLabel = classifyGrupo(grupo);
        if (!catMap.has(catLabel)) catMap.set(catLabel, []);
        const cenarios = catMap.get(catLabel)!;
        for (const ram of [...grupo.ramificacoes].sort((a, b) => a.prioridade - b.prioridade)) {
          cenarios.push(ramToCenario(grupo, ram));
        }
      }

      // Build categories in CATEGORIAS order, then "Outros" at the end
      const categories: TreeCategory[] = [];
      for (const cat of CATEGORIAS) {
        const cenarios = catMap.get(cat.label);
        if (cenarios && cenarios.length > 0) {
          categories.push({ label: cat.label, cenarios });
          catMap.delete(cat.label);
        }
      }
      // Remaining (Outros)
      for (const [label, cenarios] of catMap) {
        if (cenarios.length > 0) {
          categories.push({ label, cenarios });
        }
      }

      return { title: section.title, categories };
    });
}

// --- Components ---

export function CenarioLegend({ regras, defaultOpen = false }: CenarioLegendProps) {
  const [open, setOpen] = useState(defaultOpen);
  const r = regras ?? getDefaultRegras();
  const tree = useMemo(() => buildTree(r), [r]);

  return (
    <Card className="rounded-xl shadow-sm mb-3">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 h-auto rounded-xl"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen size={14} className="text-primary" />
          </div>
          Legenda de Cenarios
        </h2>
        <span className="text-muted-foreground">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </Button>

      {open && (
        <CardContent className="px-4 pb-3 pt-0 space-y-2.5">
          {tree.map(section => (
            <SectionBlock key={section.title} section={section} />
          ))}

          {/* Special scenarios */}
          <div className="border-t border-border pt-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Cenarios Especiais
            </h3>
            <div className="ml-4 space-y-1 text-xs">
              <SpecialRow id="DEVOLUCAO" desc="Estornar CP, fundos via DCIP 54" color="sky" />
              <SpecialRow id="VEDADO" desc="Decreto 2128 ou regra customizada" color="danger" />
              <SpecialRow id="DESCONHECIDO" desc="Verificar manualmente" color="muted" />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SectionBlock({ section }: { section: TreeSection }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-bold text-foreground uppercase tracking-wider mb-2 hover:text-primary transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {section.title}
      </button>

      {expanded && (
        <div className="space-y-0">
          {section.categories.map((cat, catIdx) => {
            const isLast = catIdx === section.categories.length - 1;
            return (
              <CategoryBlock key={cat.label} category={cat} isLast={isLast} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({ category, isLast }: { category: TreeCategory; isLast: boolean }) {
  const connector = isLast ? '└─' : '├─';

  return (
    <div className="flex text-xs">
      {/* Tree connector */}
      <div className="flex-shrink-0 w-6 text-muted-foreground/50 font-mono select-none leading-6">
        {connector}
      </div>

      {/* Category content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'border-l border-border/40 ml-0 pl-0')}>
        <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider pb-1 pl-1">
          {category.label}
        </div>
        <div className="pb-2">
          {category.cenarios.map((cenario, idx) => {
            const isLastCenario = idx === category.cenarios.length - 1;
            return (
              <CenarioRow key={cenario.id} cenario={cenario} isLast={isLastCenario} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CenarioRow({ cenario, isLast }: { cenario: TreeCenario; isLast: boolean }) {
  const connector = isLast ? '└' : '├';

  return (
    <div className="flex items-center gap-0 text-xs leading-6 hover:bg-muted/40 rounded-sm transition-colors">
      {/* Inner connector */}
      <span className="flex-shrink-0 w-4 text-muted-foreground/40 font-mono select-none text-center">
        {connector}
      </span>

      {/* Cenario ID */}
      <Badge className="font-mono font-bold text-[10px] px-1.5 py-0 bg-primary-50 text-primary-700 border-primary-100 mr-2 shrink-0">
        {cenario.id}
      </Badge>

      {/* Nome */}
      <span className="flex-1 min-w-0 truncate text-foreground mr-2" title={cenario.nome}>
        {cenario.nome}
      </span>

      {/* Aliquotas */}
      <span className="font-mono text-muted-foreground w-[70px] text-right shrink-0 mr-2">
        {cenario.aliquotas}
      </span>

      {/* Carga */}
      <span className="font-mono text-muted-foreground w-[40px] text-right shrink-0 mr-2">
        {cenario.carga}
      </span>

      {/* CP */}
      <span className="w-[24px] text-center shrink-0 mr-2">
        {cenario.temCP ? (
          <span className="text-purple-600 font-semibold">✓</span>
        ) : (
          <span className="text-muted-foreground">✗</span>
        )}
      </span>

      {/* Ref TTD */}
      <span className="font-mono text-[10px] text-muted-foreground w-[90px] text-right shrink-0 hidden sm:inline">
        {cenario.refTTD}
      </span>
    </div>
  );
}

function SpecialRow({ id, desc, color }: { id: string; desc: string; color: string }) {
  const connector = id === 'DESCONHECIDO' ? '└' : '├';

  const colorClasses: Record<string, string> = {
    sky: 'text-sky-700',
    danger: 'text-red-600',
    muted: 'text-muted-foreground',
  };

  return (
    <div className="flex items-center gap-0 leading-6">
      <span className="flex-shrink-0 w-4 text-muted-foreground/40 font-mono select-none text-center">
        {connector}
      </span>
      <span className={cn('font-mono font-bold mr-2 shrink-0', colorClasses[color] ?? 'text-foreground')}>
        {id}
      </span>
      <span className={cn(colorClasses[color] ?? 'text-muted-foreground')}>
        {desc}
      </span>
    </div>
  );
}
