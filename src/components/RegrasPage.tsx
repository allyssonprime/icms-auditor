import { useState, useRef, useMemo } from 'react';
import type { GrupoRegra, RegrasConfig } from '../types/regras.ts';
import { mergeValores } from '../types/regras.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import { useRegras } from '../hooks/useRegras.ts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, Plus, Pencil, FolderOpen, FileText, Percent, Coins, Shield, GitBranch } from 'lucide-react';
import { CenarioLegend, CATEGORIAS, classifyGrupo } from './CenarioLegend.tsx';
import { GrupoEditor } from './regras/GrupoEditor.tsx';
import { VedacaoEditor } from './regras/VedacaoEditor.tsx';
import { ConfigGlobalEditor } from './regras/ConfigGlobalEditor.tsx';
import { ImportExportPanel } from './regras/ImportExportPanel.tsx';
import { QuadroResumoTab } from './regras/QuadroResumoTab.tsx';
import { cn } from '@/lib/utils';

interface RegrasPageProps {
  onRegrasChanged: (regras: RegrasConfig) => void;
}

export function RegrasPage({ onRegrasChanged }: RegrasPageProps) {
  const {
    regras,
    isLoading,
    updateGrupos,
    updateVedacoes,
    updateGlobal,
    exportJSON,
    importJSON,
    restaurarPadrao,
  } = useRegras();

  const [activeTab, setActiveTab] = useState('resumo');
  const [editingGrupo, setEditingGrupo] = useState<string | null>(null);
  const [expandedGrupo, setExpandedGrupo] = useState<string | null>(null);
  const pendingNewGrupo = useRef<GrupoRegra | null>(null);

  // Build config tree grouped by operation → category (must be before early return)
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

  // Find the selected grupo object
  const selectedGrupo = useMemo(() => {
    if (!expandedGrupo) return null;
    return regras.grupos.find(g => g.id === expandedGrupo) ?? null;
  }, [expandedGrupo, regras.grupos]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  async function handleSaveGrupo(updated: GrupoRegra) {
    const newGrupos = regras.grupos.map(g => g.id === updated.id ? updated : g);
    // Se e novo (nao existe no array), adicionar
    if (!regras.grupos.some(g => g.id === updated.id)) {
      newGrupos.push(updated);
    }
    await updateGrupos(newGrupos);
    onRegrasChanged({ ...regras, grupos: newGrupos });
    pendingNewGrupo.current = null;
    setEditingGrupo(null);
  }

  async function handleDeleteGrupo(grupoId: string) {
    const newGrupos = regras.grupos.filter(g => g.id !== grupoId);
    await updateGrupos(newGrupos);
    onRegrasChanged({ ...regras, grupos: newGrupos });
    pendingNewGrupo.current = null;
    setEditingGrupo(null);
  }

  function handleAddGrupo() {
    const newGrupo: GrupoRegra = {
      id: `G-NOVO-${Date.now()}`,
      nome: 'Novo Grupo',
      descricao: '',
      prioridade: 100,
      ativo: true,
      condicoes: {},
      valoresBase: {
        aliquotasAceitas: [],
        cargaEfetiva: 0,
        fundos: 0,
        cstEsperado: [],
        cfopsEsperados: [],
        temCP: false,
        temDiferimentoParcial: false,
        refTTD: '',
      },
      ramificacoes: [{ cenarioId: '', nome: '', prioridade: 1 }],
    };
    pendingNewGrupo.current = newGrupo;
    setEditingGrupo(newGrupo.id);
  }

  async function handleSaveVedacoes(vedacoes: typeof regras.vedacoes) {
    await updateVedacoes(vedacoes);
    onRegrasChanged({ ...regras, vedacoes });
  }

  async function handleSaveGlobal(global: typeof regras.global) {
    await updateGlobal(global);
    onRegrasChanged({ ...regras, global });
  }

  async function handleImport(json: string) {
    const imported = await importJSON(json);
    if (imported) onRegrasChanged(imported);
  }

  async function handleRestaurar() {
    await restaurarPadrao();
    onRegrasChanged(getDefaultRegras());
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Configuracao de Regras
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie cenarios fiscais, vedacoes e parametros do motor de regras.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--surface-low)] p-1 rounded-xl">
          <TabsTrigger value="resumo" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Quadro Resumo</TabsTrigger>
          <TabsTrigger value="legenda" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Legenda</TabsTrigger>
          <TabsTrigger value="cenarios" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Cenarios</TabsTrigger>
          <TabsTrigger value="vedacoes" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Vedacoes</TabsTrigger>
          <TabsTrigger value="config" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Configuracoes</TabsTrigger>
          <TabsTrigger value="importexport" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Importar / Exportar</TabsTrigger>
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
          {editingGrupo ? (
            <GrupoEditor
              grupo={(regras.grupos.find(g => g.id === editingGrupo) ?? pendingNewGrupo.current)!}
              onSave={handleSaveGrupo}
              onCancel={() => { setEditingGrupo(null); pendingNewGrupo.current = null; }}
              onDelete={() => handleDeleteGrupo(editingGrupo)}
            />
          ) : (
            <div className="flex gap-4" style={{ minHeight: '70vh' }}>
              {/* LEFT PANEL - Tree navigation */}
              <div
                className="shrink-0 rounded-xl overflow-hidden flex flex-col"
                style={{
                  width: 280,
                  background: 'var(--surface-lowest)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--surface-high)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Arvore de Cenarios</span>
                </div>
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
                <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--surface-high)' }}>
                  <Button variant="outline" size="sm" onClick={handleAddGrupo} className="w-full text-xs gap-1">
                    <Plus size={12} /> Novo Grupo
                  </Button>
                </div>
              </div>

              {/* RIGHT PANEL - Detail */}
              <div className="flex-1 min-w-0">
                {selectedGrupo ? (
                  <GrupoDetailPanel
                    grupo={selectedGrupo}
                    onEdit={() => setEditingGrupo(selectedGrupo.id)}
                  />
                ) : (
                  <div
                    className="h-full flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--surface-lowest)', boxShadow: 'var(--shadow-sm)' }}
                  >
                    <div className="text-center space-y-2">
                      <FileText size={40} className="mx-auto text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Selecione um cenario na arvore ao lado</p>
                      <p className="text-xs text-muted-foreground/60">para visualizar os detalhes da regra</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* === VEDACOES TAB === */}
        <TabsContent value="vedacoes" className="mt-4">
          <VedacaoEditor vedacoes={regras.vedacoes} onSave={handleSaveVedacoes} />
        </TabsContent>

        {/* === CONFIG TAB === */}
        <TabsContent value="config" className="mt-4">
          <ConfigGlobalEditor global={regras.global} onSave={handleSaveGlobal} />
        </TabsContent>

        {/* === IMPORT/EXPORT TAB === */}
        <TabsContent value="importexport" className="mt-4">
          <ImportExportPanel onExport={exportJSON} onImport={handleImport} onRestaurar={handleRestaurar} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Tree navigation components for the left panel ---

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
          {/* Tree line */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: 7,
              width: 1,
              background: 'var(--surface-high)',
            }}
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
        {/* Nested tree line */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: 5,
            width: 1,
            background: 'var(--surface-high)',
          }}
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

// --- Detail panel for the right side ---

interface GrupoDetailPanelProps {
  grupo: GrupoRegra;
  onEdit: () => void;
}

function GrupoDetailPanel({ grupo, onEdit }: GrupoDetailPanelProps) {
  const valores = grupo.valoresBase;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div
        className="rounded-xl px-6 py-5 flex items-start justify-between"
        style={{ background: 'var(--surface-lowest)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h3 className="font-heading text-lg font-bold tracking-tight">{grupo.nome}</h3>
            <Badge className="font-mono text-[10px] px-2 py-0.5 bg-primary text-white">{grupo.id}</Badge>
            {!grupo.ativo && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Inativo</Badge>}
          </div>
          {grupo.descricao && (
            <p className="text-xs text-muted-foreground max-w-lg">{grupo.descricao}</p>
          )}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Prioridade: <strong>{grupo.prioridade}</strong></span>
            <span className="text-muted-foreground/30">|</span>
            <span>Operacao: <strong>{grupo.condicoes.operacao ?? 'Qualquer'}</strong></span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="text-xs gap-1.5 shrink-0">
          <Pencil size={12} /> Editar
        </Button>
      </div>

      {/* Aliquota cards grid */}
      <div>
        <h4 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
          <Percent size={14} className="text-primary" />
          Matriz de Aliquotas
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AliquotaCard
            label="Aliquotas Aceitas"
            value={valores.aliquotasAceitas.length > 0 ? valores.aliquotasAceitas.map(a => `${a}%`).join(', ') : 'N/A'}
            icon={<Percent size={16} className="text-primary/60" />}
          />
          <AliquotaCard
            label="Carga Efetiva"
            value={valores.cargaEfetiva < 0 ? 'N/A' : valores.cargaEfetiva > 0 ? `${valores.cargaEfetiva}%` : '0%'}
            icon={<Coins size={16} className="text-[var(--success)]/60" />}
          />
          <AliquotaCard
            label="FCP / Fundos"
            value={`${valores.fundos}%`}
            icon={<Shield size={16} className="text-[var(--warning)]/60" />}
          />
          <AliquotaCard
            label="Diferimento"
            value={valores.temDiferimentoParcial ? 'Sim' : 'Nao'}
            subtitle={valores.refTTD ? `TTD: ${valores.refTTD}` : undefined}
            icon={<GitBranch size={16} className="text-secondary/60" />}
          />
        </div>
      </div>

      {/* Condicoes */}
      {(
        (grupo.condicoes.tipoDest && grupo.condicoes.tipoDest.length > 0) ||
        grupo.condicoes.camex !== undefined ||
        grupo.condicoes.cobreAco !== undefined ||
        grupo.condicoes.temST !== undefined ||
        grupo.condicoes.listaEspecial ||
        grupo.condicoes.cfopMatch
      ) && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'var(--surface-lowest)', boxShadow: 'var(--shadow-sm)' }}
        >
          <h4 className="font-heading text-sm font-semibold mb-3">Condicoes de Aplicacao</h4>
          <div className="flex flex-wrap gap-1.5">
            {grupo.condicoes.tipoDest?.map(td => (
              <Badge key={td} variant="outline" className="text-[11px] px-2.5 py-1 bg-[var(--surface-low)]">{td}</Badge>
            ))}
            {grupo.condicoes.camex !== undefined && (
              <Badge variant="outline" className="text-[11px] px-2.5 py-1 bg-[var(--surface-low)]">CAMEX: {grupo.condicoes.camex ? 'Sim' : 'Nao'}</Badge>
            )}
            {grupo.condicoes.cobreAco !== undefined && (
              <Badge variant="outline" className="text-[11px] px-2.5 py-1 bg-[var(--surface-low)]">Cobre/Aco</Badge>
            )}
            {grupo.condicoes.temST !== undefined && (
              <Badge variant="outline" className="text-[11px] px-2.5 py-1 bg-[var(--surface-low)]">ST: {grupo.condicoes.temST ? 'Sim' : 'Nao'}</Badge>
            )}
            {grupo.condicoes.listaEspecial && (
              <Badge variant="outline" className="text-[11px] px-2.5 py-1 bg-[var(--surface-low)]">{grupo.condicoes.listaEspecial}</Badge>
            )}
            {grupo.condicoes.cfopMatch && (
              <Badge variant="outline" className="text-[11px] px-2.5 py-1 bg-[var(--surface-low)]">{grupo.condicoes.cfopMatch}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Base values detail */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: 'var(--surface-lowest)', boxShadow: 'var(--shadow-sm)' }}
      >
        <h4 className="font-heading text-sm font-semibold mb-3">Valores Base</h4>
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
      </div>

      {/* Ramificacoes */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: 'var(--surface-lowest)', boxShadow: 'var(--shadow-card)' }}
      >
        <h4 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
          <GitBranch size={14} className="text-primary" />
          Ramificacoes
          <Badge variant="secondary" className="text-[10px] ml-1">{grupo.ramificacoes.length}</Badge>
        </h4>
        <div className="space-y-2">
          {[...grupo.ramificacoes]
            .sort((a, b) => a.prioridade - b.prioridade)
            .map(ram => {
              const val = mergeValores(grupo.valoresBase, ram.override);
              return (
                <div
                  key={ram.cenarioId}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition-shadow hover:shadow-sm"
                  style={{ background: 'var(--surface-low)', boxShadow: 'var(--shadow-xs)' }}
                >
                  <Badge className="text-[11px] font-mono shrink-0 bg-primary text-white">{ram.cenarioId}</Badge>
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
      </div>
    </div>
  );
}

// --- Aliquota metric card ---

function AliquotaCard({ label, value, subtitle, icon }: { label: string; value: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex items-start gap-3"
      style={{ background: 'var(--surface-lowest)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{label}</div>
        <div className="text-sm font-heading font-bold text-foreground tabular-nums">{value}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

// --- Legacy tree components (kept for reference but no longer used in Cenarios tab) ---
// ConfigSectionBlock, ConfigCategoryBlock, ConfigGrupoNode are replaced by the
// TreeSection/TreeCategory + GrupoDetailPanel split layout above.
