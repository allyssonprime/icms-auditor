import { useState, useMemo } from 'react';
import type { GrupoRegra } from '../types/regras.ts';
import { mergeValores } from '../types/regras.ts';
import { REGRAS, REGRAS_VERSION } from '../data/defaultRegras.ts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, FolderOpen, FileText, Percent, Coins, Shield, GitBranch, Lock } from 'lucide-react';
import { PageHeader } from './layout/PageHeader.tsx';
import { CenarioLegend, CATEGORIAS, classifyGrupo } from './CenarioLegend.tsx';
import { QuadroResumoTab } from './regras/QuadroResumoTab.tsx';
import { cn } from '@/lib/utils';

export function RegrasPage() {
  const regras = REGRAS;

  const [activeTab, setActiveTab] = useState('resumo');
  const [expandedGrupo, setExpandedGrupo] = useState<string | null>(null);

  // Build config tree grouped by operation → category
  const configTree = useMemo(() => {
    const grupos = [...regras.grupos].sort((a, b) => a.prioridade - b.prioridade);

    const sections: { key: string; title: string; grupos: GrupoRegra[] }[] = [
      { key: 'interestadual', title: 'Interestadual', grupos: grupos.filter(g => g.condicoes.operacao === 'interestadual') },
      { key: 'interna', title: 'Interna (SC)', grupos: grupos.filter(g => g.condicoes.operacao === 'interna') },
    ];
    const other = grupos.filter(g => !g.condicoes.operacao);
    if (other.length > 0) sections.push({ key: 'outros', title: 'Outros', grupos: other });

    return sections.filter(s => s.grupos.length > 0).map(section => {
      const catMap = new Map<string, GrupoRegra[]>();
      for (const grupo of section.grupos) {
        const catLabel = classifyGrupo(grupo);
        if (!catMap.has(catLabel)) catMap.set(catLabel, []);
        catMap.get(catLabel)!.push(grupo);
      }
      const categories: { label: string; grupos: GrupoRegra[] }[] = [];
      for (const cat of CATEGORIAS) {
        const g = catMap.get(cat.label);
        if (g?.length) { categories.push({ label: cat.label, grupos: g }); catMap.delete(cat.label); }
      }
      for (const [label, g] of catMap) {
        if (g.length) categories.push({ label, grupos: g });
      }
      return { title: section.title, categories };
    });
  }, [regras]);

  const selectedGrupo = useMemo(() => {
    if (!expandedGrupo) return null;
    return regras.grupos.find(g => g.id === expandedGrupo) ?? null;
  }, [expandedGrupo, regras.grupos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras TTD 410"
        breadcrumb={<span>Logica fiscal fixa no codigo. Para editar listas de NCMs/CNPJs, use a pagina Cadastros.</span>}
        actions={
          <>
            <Badge variant="outline" className="text-[10px] gap-1"><Lock size={10} /> referencia</Badge>
            <Badge variant="secondary" className="text-[10px]">v{REGRAS_VERSION}</Badge>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--surface-low)] p-1 rounded-xl">
          <TabsTrigger value="resumo" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Quadro Resumo</TabsTrigger>
          <TabsTrigger value="legenda" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Legenda</TabsTrigger>
          <TabsTrigger value="cenarios" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Cenarios</TabsTrigger>
          <TabsTrigger value="vedacoes" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Vedacoes</TabsTrigger>
          <TabsTrigger value="config" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Config Global</TabsTrigger>
        </TabsList>

        {/* === QUADRO RESUMO TAB === */}
        <TabsContent value="resumo" className="mt-4">
          <QuadroResumoTab
            regras={regras}
            onNavigateToGrupo={(grupoId) => {
              setExpandedGrupo(grupoId);
              setActiveTab('cenarios');
            }}
          />
        </TabsContent>

        {/* === LEGENDA TAB === */}
        <TabsContent value="legenda" className="mt-4">
          <CenarioLegend regras={regras} defaultOpen />
        </TabsContent>

        {/* === CENARIOS TAB === */}
        <TabsContent value="cenarios" className="mt-4">
          <div className="flex gap-4" style={{ minHeight: '70vh' }}>
            <Card className="w-[280px] shrink-0 overflow-hidden flex flex-col">
              <CardHeader className="px-4 py-3 border-b border-[var(--border-soft)] space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Arvore de Cenarios
                </CardTitle>
              </CardHeader>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {configTree.map(section => (
                  <TreeSection
                    key={section.title}
                    title={section.title}
                    categories={section.categories}
                    expandedGrupo={expandedGrupo}
                    onSelectGrupo={id => setExpandedGrupo(expandedGrupo === id ? null : id)}
                  />
                ))}
              </div>
            </Card>

            <div className="flex-1 min-w-0">
              {selectedGrupo ? (
                <GrupoDetailPanel grupo={selectedGrupo} />
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <FileText size={40} className="mx-auto text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Selecione um cenario na arvore ao lado</p>
                    <p className="text-xs text-muted-foreground/60">para visualizar os detalhes da regra</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* === VEDACOES TAB === */}
        <TabsContent value="vedacoes" className="mt-4">
          <VedacoesReadOnly />
        </TabsContent>

        {/* === CONFIG GLOBAL TAB === */}
        <TabsContent value="config" className="mt-4">
          <ConfigGlobalReadOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Tree navigation components ---

interface TreeSectionProps {
  title: string;
  categories: { label: string; grupos: GrupoRegra[] }[];
  expandedGrupo: string | null;
  onSelectGrupo: (id: string) => void;
}

function TreeSection({ title, categories, expandedGrupo, onSelectGrupo }: TreeSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const sectionLabel = title.toUpperCase().replace(/\(.*\)/, '').trim();

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-[var(--surface-low)] transition-colors"
      >
        <FolderOpen size={14} className="text-primary/70 shrink-0" />
        <span className="flex-1 text-left truncate">{sectionLabel}</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="relative ml-3">
          <div
            className="absolute top-0 bottom-0"
            style={{ left: 7, width: 1, background: 'var(--surface-high)' }}
          />
          {categories.map(cat => (
            <TreeCategory
              key={cat.label}
              label={cat.label}
              grupos={cat.grupos}
              expandedGrupo={expandedGrupo}
              onSelectGrupo={onSelectGrupo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TreeCategoryProps {
  label: string;
  grupos: GrupoRegra[];
  expandedGrupo: string | null;
  onSelectGrupo: (id: string) => void;
}

function TreeCategory({ label, grupos, expandedGrupo, onSelectGrupo }: TreeCategoryProps) {
  return (
    <div className="mb-0.5">
      <div className="flex items-center gap-1 pl-4 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</span>
      </div>
      <div className="relative ml-2">
        <div
          className="absolute top-0 bottom-0"
          style={{ left: 5, width: 1, background: 'var(--surface-high)' }}
        />
        {grupos.map(grupo => {
          const isActive = expandedGrupo === grupo.id;
          return (
            <button
              key={grupo.id}
              onClick={() => onSelectGrupo(grupo.id)}
              className={cn(
                'w-full flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-lg text-left transition-colors text-xs',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-foreground/80 hover:bg-[var(--surface-low)]',
                !grupo.ativo && 'opacity-50',
              )}
            >
              <FileText size={12} className={cn('shrink-0', isActive ? 'text-white/80' : 'text-muted-foreground/50')} />
              <span className="truncate flex-1">{grupo.nome}</span>
              {!grupo.ativo && (
                <span className={cn('text-[9px]', isActive ? 'text-white/60' : 'text-muted-foreground/40')}>OFF</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Read-only detail panel for selected grupo ---

function MetricCard({ label, value, subtitle, icon }: { label: string; value: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <Card className="px-4 py-3 flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-primary/70">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{label}</div>
        <div className="text-sm font-heading font-bold text-foreground tabular-nums truncate">{value}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
      </div>
    </Card>
  );
}

function GrupoDetailPanel({ grupo }: { grupo: GrupoRegra }) {
  const valores = grupo.valoresBase;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{grupo.nome}</CardTitle>
            <Badge className="font-mono text-[10px]">{grupo.id}</Badge>
            {!grupo.ativo && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
          </div>
          {grupo.descricao && (
            <CardDescription className="text-xs max-w-lg">{grupo.descricao}</CardDescription>
          )}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
            <span>Prioridade: <strong>{grupo.prioridade}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span>Operacao: <strong>{grupo.condicoes.operacao ?? 'Qualquer'}</strong></span>
          </div>
        </CardHeader>
      </Card>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Percent size={12} className="text-primary" />
          Matriz de Aliquotas
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Aliquotas Aceitas"
            value={valores.aliquotasAceitas.length > 0 ? valores.aliquotasAceitas.map(a => `${a}%`).join(', ') : 'N/A'}
            icon={<Percent size={14} />}
          />
          <MetricCard
            label="Carga Efetiva"
            value={valores.cargaEfetiva < 0 ? 'N/A' : valores.cargaEfetiva > 0 ? `${valores.cargaEfetiva}%` : '0%'}
            icon={<Coins size={14} />}
          />
          <MetricCard
            label="FCP / Fundos"
            value={`${valores.fundos}%`}
            icon={<Shield size={14} />}
          />
          <MetricCard
            label="Diferimento"
            value={valores.temDiferimentoParcial ? 'Sim' : 'Nao'}
            subtitle={valores.refTTD ? `TTD ${valores.refTTD}` : undefined}
            icon={<GitBranch size={14} />}
          />
        </div>
      </div>

      {(
        (grupo.condicoes.tipoDest && grupo.condicoes.tipoDest.length > 0) ||
        grupo.condicoes.camex !== undefined ||
        grupo.condicoes.cobreAco !== undefined ||
        grupo.condicoes.temST !== undefined ||
        grupo.condicoes.listaEspecial ||
        grupo.condicoes.cfopMatch
      ) && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Condicoes de Aplicacao</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-1.5">
              {grupo.condicoes.tipoDest?.map(td => (
                <Badge key={td} variant="outline" className="text-[11px]">{td}</Badge>
              ))}
              {grupo.condicoes.camex !== undefined && (
                <Badge variant="outline" className="text-[11px]">CAMEX: {grupo.condicoes.camex ? 'Sim' : 'Nao'}</Badge>
              )}
              {grupo.condicoes.cobreAco !== undefined && (
                <Badge variant="outline" className="text-[11px]">Cobre/Aco</Badge>
              )}
              {grupo.condicoes.temST !== undefined && (
                <Badge variant="outline" className="text-[11px]">ST: {grupo.condicoes.temST ? 'Sim' : 'Nao'}</Badge>
              )}
              {grupo.condicoes.listaEspecial && (
                <Badge variant="outline" className="text-[11px]">{grupo.condicoes.listaEspecial}</Badge>
              )}
              {grupo.condicoes.cfopMatch && (
                <Badge variant="outline" className="text-[11px]">{grupo.condicoes.cfopMatch}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valores Base</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
            {valores.cstEsperado.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">CST</span>
                <p className="font-mono font-medium text-foreground">{valores.cstEsperado.join(', ')}</p>
              </div>
            )}
            {valores.cfopsEsperados.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">CFOPs</span>
                <p className="font-mono font-medium text-foreground">{valores.cfopsEsperados.join(', ')}</p>
              </div>
            )}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Credito Presumido</span>
              <p className="font-medium text-foreground">{valores.temCP ? 'Sim' : 'Nao'}</p>
            </div>
            {valores.refTTD && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Ref. TTD</span>
                <p className="font-mono font-medium text-foreground">{valores.refTTD}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitBranch size={12} className="text-primary" />
            Ramificacoes
            <Badge variant="secondary" className="text-[10px] ml-1">{grupo.ramificacoes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-1.5">
            {[...grupo.ramificacoes]
              .sort((a, b) => a.prioridade - b.prioridade)
              .map(ram => {
                const val = mergeValores(grupo.valoresBase, ram.override);
                return (
                  <div
                    key={ram.cenarioId}
                    className="flex items-center gap-3 rounded-md px-3 py-2 bg-surface-low"
                  >
                    <Badge className="text-[10px] font-mono shrink-0">{ram.cenarioId}</Badge>
                    <span className="text-xs font-medium flex-1 truncate">{ram.nome}</span>
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                      {val.aliquotasAceitas.length > 0
                        ? val.aliquotasAceitas.map(a => `${a}%`).join('/')
                        : 'dif.'}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                      {val.cargaEfetiva < 0 ? 'N/A' : val.cargaEfetiva > 0 ? `${val.cargaEfetiva}%` : '-'}
                    </span>
                    {ram.condicaoExtra?.camex !== undefined && (
                      <Badge variant="outline" className="text-[10px]">CAMEX: {ram.condicaoExtra.camex ? 'Sim' : 'Nao'}</Badge>
                    )}
                    {ram.condicaoExtra?.listaEspecial && (
                      <Badge variant="outline" className="text-[10px]">{ram.condicaoExtra.listaEspecial}</Badge>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Read-only vedacoes list ---

function VedacoesReadOnly() {
  return (
    <div className="space-y-3">
      {REGRAS.vedacoes.map(v => (
        <Card key={v.id}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="font-mono text-[10px]">{v.regra}</Badge>
                <CardTitle className="text-sm">{v.nome}</CardTitle>
                {!v.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{v.tipo}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground mb-2">{v.mensagemErro}</p>
            {v.fonte === 'config' && v.campoConfig && (
              <p className="text-[10px] text-muted-foreground/70">Fonte: <span className="font-mono">AppConfig.{v.campoConfig}</span> (editavel em Cadastros)</p>
            )}
            {v.fonte === 'inline' && v.valores && (
              <p className="text-[10px] text-muted-foreground/70 font-mono">Valores: {v.valores.join(', ')}</p>
            )}
            {v.excecao && (
              <div className="mt-2 pt-2 border-t border-dashed">
                <p className="text-[10px] text-muted-foreground">
                  <strong>Excecao ({v.excecao.regraExcecao}):</strong> {v.excecao.descricao}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Read-only config global ---

function ConfigGlobalReadOnly() {
  const g = REGRAS.global;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aliquotas Interestaduais por UF</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(g.ufAliquotas).map(([uf, aliq]) => (
              <div key={uf} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-low">
                <span className="font-mono text-xs font-bold">{uf}</span>
                <span className="text-xs tabular-nums">{aliq}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">Demais UFs = 7% (fallback automatico via Res SF 22/89)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aliquotas Internas Validas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {g.aliquotasInternasValidas.map(a => (
              <Badge key={a} variant="outline" className="text-[11px] font-mono">{a}%</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CFOPs Especiais</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Devolucao</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {g.cfopsDevolucao.map(c => (
                  <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Transferencia</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {g.cfopsTransferencia.map(c => (
                  <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fundos Padrao</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-lg font-heading font-bold tabular-nums">{(g.fundosPadrao * 100).toFixed(1)}%</div>
          <p className="text-[10px] text-muted-foreground mt-1">FUNDEC + FUMDES + Pro-Emprego + Fundo Social (separados do ICMS)</p>
        </CardContent>
      </Card>
    </div>
  );
}
