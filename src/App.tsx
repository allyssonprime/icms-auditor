import { useState, useCallback, useEffect, useRef } from 'react';
import type { NfeValidation, ActiveFilters, StatusType, CnpjInfo } from './types/validation.ts';
import type { AppConfig } from './types/config.ts';
import { parseNfe } from './engine/parser.ts';
import { validarNfe } from './engine/validator.ts';
import { DECRETO_2128 } from './data/decreto2128.ts';
import { COBRE_ACO_PREFIXES } from './data/cobreAco.ts';
import { ALIQUOTAS_INTERNAS_VALIDAS } from './data/aliquotasInternas.ts';
import { DropZone } from './components/DropZone.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { ExportButton } from './components/ExportButton.tsx';
import { GroupingPanel } from './components/GroupingPanel.tsx';
import { NfeListView } from './components/NfeListView.tsx';
import { CnpjLookupPanel } from './components/CnpjLookupPanel.tsx';
import { CenarioLegend } from './components/CenarioLegend.tsx';
import { CadastrosPage } from './components/CadastrosPage.tsx';
import { SimuladorPage } from './components/SimuladorPage.tsx';
import { HistoricoPanel } from './components/HistoricoPanel.tsx';
import { loadFullAppConfig, type EmpresaCadastro } from './firebase/configService.ts';
import { salvarAuditoria } from './firebase/auditoriaService.ts';
import { commitHash } from 'virtual:git-hash';
import { ShieldCheck, Calculator, Settings, RefreshCw, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const ALLOWED_CFOPS = new Set(['5949', '5102', '6102']);

function getDefaultConfig(): AppConfig {
  return {
    decreto2128: DECRETO_2128,
    listaCamex: [],
    listaCobreAco: COBRE_ACO_PREFIXES,
    listaSN: [],
    listaIndustriais: [],
    listaCD: [],
    listaVedacao25a: [],
    listaVedacao25b: [],
    ufAliquotas: {},
    aliquotasInternasValidas: ALIQUOTAS_INTERNAS_VALIDAS,
  };
}

function emptyFilters(): ActiveFilters {
  return {
    aliquota: new Set<number>(),
    cst: new Set<string>(),
    cfop: new Set<string>(),
    cenario: new Set<string>(),
    status: new Set<StatusType>(),
    vedado: new Set<string>(),
    creditoPresumido: new Set<string>(),
    tipoOperacao: new Set<string>(),
    searchText: '',
  };
}

function nfeHasAllowedCfop(items: Array<{ cfop: string }>): boolean {
  return items.some(item => ALLOWED_CFOPS.has(item.cfop));
}

function nfeHasValue(items: Array<{ vProd: number }>): boolean {
  return items.some(item => item.vProd > 0);
}

function nfeHasTaxableItems(items: Array<{ vBC: number; pICMS: number }>): boolean {
  return items.some(item => item.vBC > 0 || item.pICMS > 0);
}

interface ParseError {
  fileName: string;
  error: string;
}

type ActiveView = 'auditor' | 'cadastros' | 'simulador';

export default function App() {
  const { logout } = useAuth();
  const [config, setConfig] = useState<AppConfig>(getDefaultConfig);
  const [empresas, setEmpresas] = useState<EmpresaCadastro[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [results, setResults] = useState<NfeValidation[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('auditor');
  const [filters, setFilters] = useState<ActiveFilters>(emptyFilters);
  const [cnpjInfoMap, setCnpjInfoMap] = useState<Map<string, CnpjInfo>>(new Map());
  const [discardedByCfop, setDiscardedByCfop] = useState(0);
  const [discardedZero, setDiscardedZero] = useState(0);
  const [discardedDuplicates, setDiscardedDuplicates] = useState(0);
  const [historicoRefreshKey, setHistoricoRefreshKey] = useState(0);

  const configRef = useRef(config);
  configRef.current = config;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const reloadFromFirebase = useCallback(async () => {
    try {
      const { config: newConfig, empresas: newEmpresas } = await loadFullAppConfig(getDefaultConfig());
      setConfig(newConfig);
      setEmpresas(newEmpresas);

      const newMap = new Map<string, CnpjInfo>();
      for (const e of newEmpresas) {
        newMap.set(e.cnpj, {
          cnpj: e.cnpj,
          razaoSocial: e.razaoSocial,
          simplesOptante: e.simplesOptante,
          isMei: e.isMei,
          cnaePrincipal: e.cnaePrincipal,
          cnaeDescricao: e.cnaeDescricao,
          cnaesSecundarios: [],
          isIndustrial: e.industrialOverride !== undefined ? e.industrialOverride : e.isIndustrial,
        });
      }
      setCnpjInfoMap(newMap);
    } catch (err) {
      console.error('[Firebase] Erro ao carregar config:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setConfigLoading(true);
      await reloadFromFirebase();
      setConfigLoading(false);
    })();
  }, [reloadFromFirebase]);

  useEffect(() => {
    setResults(prev => {
      if (prev.length === 0) return prev;
      return prev.map(r => validarNfe(r.nfe, config, cnpjInfoMap));
    });
  }, [config, cnpjInfoMap]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);
      const newResults: NfeValidation[] = [];
      const newErrors: ParseError[] = [];
      let cfopDiscarded = 0;
      let zeroDiscarded = 0;
      let duplicatedCount = 0;
      const existingChaves = new Set(resultsRef.current.map(r => r.nfe.chaveAcesso));
      const chavesNesteLote = new Set<string>();

      for (const file of files) {
        try {
          const text = await file.text();
          const parseResult = parseNfe(text, file.name);
          if (parseResult.success) {
            if (!nfeHasValue(parseResult.data.itens)) {
              zeroDiscarded++;
            } else if (!nfeHasAllowedCfop(parseResult.data.itens)) {
              cfopDiscarded++;
            } else if (!nfeHasTaxableItems(parseResult.data.itens)) {
              zeroDiscarded++;
            } else {
              const chave = parseResult.data.chaveAcesso;
              if (existingChaves.has(chave) || chavesNesteLote.has(chave)) {
                duplicatedCount++;
              } else {
                existingChaves.add(chave);
                chavesNesteLote.add(chave);
                newResults.push(validarNfe(parseResult.data, config, cnpjInfoMap));
              }
            }
          } else {
            newErrors.push({ fileName: file.name, error: parseResult.error });
          }
        } catch (e) {
          newErrors.push({
            fileName: file.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      setResults(prev => [...prev, ...newResults]);
      setParseErrors(prev => [...prev, ...newErrors]);
      setDiscardedByCfop(prev => prev + cfopDiscarded);
      setDiscardedZero(prev => prev + zeroDiscarded);
      setDiscardedDuplicates(prev => prev + duplicatedCount);
      setIsProcessing(false);

      if (newResults.length > 0) {
        try {
          await salvarAuditoria(newResults, configRef.current, cfopDiscarded, zeroDiscarded);
          setHistoricoRefreshKey(k => k + 1);
        } catch (err) {
          console.error('[Auditoria] Erro ao salvar:', err);
        }
      }
    },
    [config, cnpjInfoMap],
  );

  const handleClear = () => {
    setResults([]);
    setParseErrors([]);
    setFilters(emptyFilters());
    setCnpjInfoMap(new Map());
    setDiscardedByCfop(0);
    setDiscardedZero(0);
    setDiscardedDuplicates(0);
  };

  const handleReprocess = useCallback(() => {
    setResults(prev => {
      if (prev.length === 0) return prev;
      return prev.map(r => validarNfe(r.nfe, config, cnpjInfoMap));
    });
  }, [config, cnpjInfoMap]);

  const handleCnpjInfoLoaded = useCallback((info: CnpjInfo) => {
    setCnpjInfoMap(prev => new Map(prev).set(info.cnpj, info));
  }, []);

  const handleEmpresasUpdated = useCallback(() => {
    reloadFromFirebase();
  }, [reloadFromFirebase]);

  const handleToggleFilter = useCallback((type: keyof ActiveFilters, value: string | number) => {
    setFilters(prev => {
      const next = { ...prev };
      if (type === 'searchText') {
        next.searchText = String(value);
      } else if (type === 'aliquota') {
        const s = new Set(prev.aliquota);
        const v = value as number;
        if (s.has(v)) s.delete(v); else s.add(v);
        next.aliquota = s;
      } else if (type === 'status') {
        const s = new Set(prev.status);
        const v = value as StatusType;
        if (s.has(v)) s.delete(v); else s.add(v);
        next.status = s;
      } else {
        const s = new Set(prev[type]);
        const v = String(value);
        if (s.has(v)) s.delete(v); else s.add(v);
        (next as Record<string, unknown>)[type] = s;
      }
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(emptyFilters());
  }, []);

  const handleQuickGroup = useCallback((type: keyof ActiveFilters, values: Array<string | number>) => {
    setFilters(prev => {
      const next = emptyFilters();
      if (type === 'searchText') return next;
      if (type === 'aliquota') {
        const current = prev.aliquota;
        const same = values.length === current.size && values.every(v => current.has(v as number));
        if (!same) next.aliquota = new Set(values as number[]);
      } else if (type === 'status') {
        const current = prev.status;
        const same = values.length === current.size && values.every(v => current.has(v as StatusType));
        if (!same) next.status = new Set(values as StatusType[]);
      } else {
        const current = prev[type] as Set<string>;
        const strValues = values.map(String);
        const same = strValues.length === current.size && strValues.every(v => current.has(v));
        if (!same) (next as Record<string, unknown>)[type] = new Set(strValues);
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setFilters(prev => ({ ...prev, searchText: text }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteudo principal
      </a>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#2B318A] to-[#5A81FA] shadow-lg">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <button
              onClick={() => setActiveView('auditor')}
              className="flex items-center gap-3 rounded-lg -ml-2 px-2 py-1.5 transition-colors hover:bg-white/10 cursor-pointer"
              aria-label={activeView === 'auditor' ? 'Auditor (pagina atual)' : 'Voltar ao Auditor'}
            >
              <img src="/icone-azul.png" alt="Prime" className="w-8 h-8 object-contain brightness-0 invert" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white leading-tight text-left tracking-wide">PRIME NF-e Auditor</h1>
                <p className="text-[10px] text-white/60 leading-tight">TTD 410/SC &middot; {__BUILD_TIMESTAMP__}</p>
              </div>
            </button>

            {/* Navigation Tabs */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ActiveView)}>
              <TabsList className="bg-white/15 border-0">
                <TabsTrigger value="auditor" className="gap-1.5 text-white/70 data-[state=active]:bg-white data-[state=active]:text-[#2B318A] data-[state=active]:shadow-md">
                  <ShieldCheck size={15} aria-hidden />
                  <span className="hidden sm:inline text-xs font-semibold">Auditor</span>
                </TabsTrigger>
                <TabsTrigger value="simulador" className="gap-1.5 text-white/70 data-[state=active]:bg-white data-[state=active]:text-[#2B318A] data-[state=active]:shadow-md">
                  <Calculator size={15} aria-hidden />
                  <span className="hidden sm:inline text-xs font-semibold">Simulador</span>
                </TabsTrigger>
                <TabsTrigger value="cadastros" className="gap-1.5 text-white/70 data-[state=active]:bg-white data-[state=active]:text-[#2B318A] data-[state=active]:shadow-md">
                  <Settings size={15} aria-hidden />
                  <span className="hidden sm:inline text-xs font-semibold">Cadastros</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {activeView === 'auditor' && results.length > 0 && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleReprocess}
                    title="Reprocessar todas as NF-es com as configuracoes atuais"
                    className="bg-white/15 text-white border-0 hover:bg-white/25 text-xs"
                  >
                    <RefreshCw size={13} aria-hidden />
                    <span className="hidden md:inline">Reprocessar</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleClear}
                    title="Limpar resultados"
                    className="bg-white/15 text-white border-0 hover:bg-white/25 text-xs"
                  >
                    <Trash2 size={13} aria-hidden />
                    <span className="hidden md:inline">Limpar</span>
                  </Button>
                </>
              )}
              <ExportButton results={results} />
              <Button
                variant="secondary"
                size="sm"
                onClick={logout}
                title="Sair"
                className="bg-white/15 text-white border-0 hover:bg-white/25 text-xs"
              >
                <LogOut size={13} aria-hidden />
                <span className="hidden md:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {configLoading ? (
          <div className="space-y-4 py-8">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        ) : activeView === 'cadastros' ? (
          <CadastrosPage onConfigChanged={handleEmpresasUpdated} />
        ) : activeView === 'simulador' ? (
          <SimuladorPage
            config={config}
            empresas={empresas}
            cnpjInfoMap={cnpjInfoMap}
            onCnpjInfoLoaded={handleCnpjInfoLoaded}
          />
        ) : (
          <div className="space-y-5">
            <DropZone onFiles={handleFiles} isProcessing={isProcessing} />

            <HistoricoPanel refreshKey={historicoRefreshKey} />

            <Dashboard
              results={results}
              uploadedTotal={results.length + discardedByCfop + discardedZero + discardedDuplicates + parseErrors.length}
              discardedByCfop={discardedByCfop}
              discardedZero={discardedZero}
              discardedDuplicates={discardedDuplicates}
              config={config}
            />

            {results.length > 0 && (
              <>
                <CenarioLegend />

                <GroupingPanel
                  results={results}
                  filters={filters}
                  onToggleFilter={handleToggleFilter}
                  onClearFilters={handleClearFilters}
                  onQuickGroup={handleQuickGroup}
                  onSearchChange={handleSearchChange}
                  cnpjInfoMap={cnpjInfoMap}
                />

                <CnpjLookupPanel
                  results={results}
                  empresas={empresas}
                  onCnpjInfoLoaded={handleCnpjInfoLoaded}
                  onEmpresasUpdated={handleEmpresasUpdated}
                />

                <NfeListView results={results} filters={filters} cnpjInfoMap={cnpjInfoMap} />
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-1 right-2 text-[10px] text-muted-foreground select-none pointer-events-none">
        build {commitHash}
      </footer>
    </div>
  );
}
