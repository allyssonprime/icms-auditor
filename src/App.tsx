import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';

import type { NfeValidation, ActiveFilters, StatusType, CnpjInfo } from './types/validation.ts';
import type { AppConfig } from './types/config.ts';
import { parseNfe } from './engine/parser.ts';
import { validarNfe } from './engine/validator.ts';
import { detectarCanceladas, filtrarNfes } from './engine/nfeFilters.ts';
import { parseEfd } from './engine/efdParser.ts';
import { crossValidate } from './engine/crossValidator.ts';
import type { EfdData } from './types/efd.ts';
import type { CrossValidationResult } from './types/crossValidation.ts';
import { DECRETO_2128 } from './data/decreto2128.ts';
import { COBRE_ACO_PREFIXES } from './data/cobreAco.ts';
import { ALIQUOTAS_INTERNAS_VALIDAS } from './data/aliquotasInternas.ts';
import { DropZone } from './components/DropZone.tsx';
import { Dashboard } from './components/Dashboard.tsx';

import { GroupingPanel } from './components/GroupingPanel.tsx';

import { CnpjLookupPanel } from './components/CnpjLookupPanel.tsx';
import { CenarioLegend } from './components/CenarioLegend.tsx';
import { AuditWorkspace } from './components/audit/AuditWorkspace.tsx';
import { HistoricoPanel } from './components/HistoricoPanel.tsx';
import { loadFullAppConfig, type EmpresaCadastro } from './firebase/configService.ts';
import { salvarAuditoria } from './firebase/auditoriaService.ts';
import { REGRAS } from './data/defaultRegras.ts';
import { commitHash } from 'virtual:git-hash';
import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { TopBar } from './components/layout/TopBar.tsx';

const loadCadastrosPage = () => import('./components/CadastrosPage.tsx');
const loadSimuladorPage = () => import('./components/SimuladorPage.tsx');
const loadRegrasPage = () => import('./components/RegrasPage.tsx');
const loadReconciliacaoPanel = () => import('./components/ReconciliacaoPanel.tsx');
const loadApuracaoTTDPage = () => import('./components/ApuracaoTTDPage.tsx');
const loadCrossValidationPanel = () => import('./components/CrossValidationPanel.tsx');

const CadastrosPage = lazy(async () => {
  const module = await loadCadastrosPage();
  return { default: module.CadastrosPage };
});
const SimuladorPage = lazy(async () => {
  const module = await loadSimuladorPage();
  return { default: module.SimuladorPage };
});
const RegrasPage = lazy(async () => {
  const module = await loadRegrasPage();
  return { default: module.RegrasPage };
});
const ReconciliacaoPanel = lazy(async () => {
  const module = await loadReconciliacaoPanel();
  return { default: module.ReconciliacaoPanel };
});
const ApuracaoTTDPage = lazy(async () => {
  const module = await loadApuracaoTTDPage();
  return { default: module.ApuracaoTTDPage };
});
const CrossValidationPanel = lazy(async () => {
  const module = await loadCrossValidationPanel();
  return { default: module.CrossValidationPanel };
});

const ALLOWED_CFOPS = new Set(['5949', '6949', '5102', '6102']);

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
    listaCamex210: [],
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
    confianca: new Set<string>(),
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

export type ActiveView = 'auditor' | 'cadastros' | 'simulador' | 'regras' | 'reconciliacao' | 'apuracao_ttd' | 'cross_validation';

const VIEW_PRELOADERS: Partial<Record<ActiveView, () => Promise<unknown>>> = {
  cadastros: loadCadastrosPage,
  simulador: loadSimuladorPage,
  regras: loadRegrasPage,
  reconciliacao: loadReconciliacaoPanel,
  apuracao_ttd: loadApuracaoTTDPage,
  cross_validation: loadCrossValidationPanel,
};

function ViewLoadingFallback() {
  return (
    <div className="space-y-4 py-8">
      <Skeleton className="h-8 w-56 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(getDefaultConfig);
  const [empresas, setEmpresas] = useState<EmpresaCadastro[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [results, setResults] = useState<NfeValidation[]>([]);
  const [rawNfes, setRawNfes] = useState<import('./types/nfe.ts').NfeData[]>([]);
  const [canceladasSet, setCanceladasSet] = useState<Set<string>>(new Set());
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('auditor');
  const [filters, setFilters] = useState<ActiveFilters>(emptyFilters);
  const [cnpjInfoMap, setCnpjInfoMap] = useState<Map<string, CnpjInfo>>(new Map());
  const [discardedByCfop, setDiscardedByCfop] = useState(0);
  const [discardedZero, setDiscardedZero] = useState(0);
  const [discardedDuplicates, setDiscardedDuplicates] = useState(0);
  const [historicoRefreshKey, setHistoricoRefreshKey] = useState(0);
  const [efdData, setEfdData] = useState<EfdData | null>(null);
  const [efdParseError, setEfdParseError] = useState<string | null>(null);
  const [crossValidation, setCrossValidation] = useState<CrossValidationResult | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const preloadedViewsRef = useRef<Set<ActiveView>>(new Set(['auditor']));

  const preloadView = useCallback((view: ActiveView) => {
    if (preloadedViewsRef.current.has(view)) return;

    const loader = VIEW_PRELOADERS[view];
    if (!loader) return;

    preloadedViewsRef.current.add(view);
    void loader();
  }, []);

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
    const viewsToWarm: ActiveView[] = ['simulador', 'cadastros', 'regras'];
    const run = () => {
      for (const view of viewsToWarm) preloadView(view);
    };

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(run, { timeout: 1500 });
      return () => {
        if (typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(run, 800);
    return () => window.clearTimeout(timeoutId);
  }, [preloadView]);

  useEffect(() => {
    if (rawNfes.length === 0) return;

    // Re-aplica filtros + validação quando config/regras/cnpjInfoMap mudam
    const { accepted: postFilters } = filtrarNfes(rawNfes, canceladasSet);

    let cfopDisc = 0;
    let zeroDisc = 0;
    const accepted: import('./types/nfe.ts').NfeData[] = [];
    for (const nfe of postFilters) {
      if (!nfeHasValue(nfe.itens)) zeroDisc++;
      else if (!nfeHasAllowedCfop(nfe.itens)) cfopDisc++;
      else if (!nfeHasTaxableItems(nfe.itens)) zeroDisc++;
      else accepted.push(nfe);
    }

    setResults(accepted.map(nfe => validarNfe(nfe, config, cnpjInfoMap, REGRAS)));
    setDiscardedByCfop(cfopDisc);
    setDiscardedZero(zeroDisc);
  }, [config, cnpjInfoMap, rawNfes, canceladasSet]);

  // Cross-validation: trigger when both XML and EFD data are available
  useEffect(() => {
    if (rawNfes.length === 0 || !efdData) {
      setCrossValidation(null);
      return;
    }
    setCrossValidation(crossValidate(rawNfes, canceladasSet, efdData));
  }, [rawNfes, canceladasSet, efdData]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);

      // Separate EFD (.txt) files from XML files
      const xmlFiles: File[] = [];
      const efdFiles: File[] = [];
      for (const f of files) {
        if (f.name.toLowerCase().endsWith('.txt')) {
          efdFiles.push(f);
        } else {
          xmlFiles.push(f);
        }
      }

      // Process EFD files
      for (const efdFile of efdFiles) {
        try {
          const buffer = await efdFile.arrayBuffer();
          const efdResult = parseEfd(buffer, efdFile.name);
          if (efdResult.success) {
            setEfdData(efdResult.data);
            setEfdParseError(null);
          } else {
            setEfdParseError(efdResult.error);
          }
        } catch (e) {
          setEfdParseError(e instanceof Error ? e.message : String(e));
        }
      }

      // If only EFD files were uploaded, stop here
      if (xmlFiles.length === 0) {
        setIsProcessing(false);
        return;
      }

      const newErrors: ParseError[] = [];
      let cfopDiscarded = 0;
      let zeroDiscarded = 0;
      let duplicatedCount = 0;
      const existingChaves = new Set(resultsRef.current.map(r => r.nfe.chaveAcesso));
      const chavesNesteLote = new Set<string>();

      // FILTRO 1 — detectar chaves canceladas pelo nome do arquivo
      const canceladas = detectarCanceladas(xmlFiles.map(f => f.name));

      // Primeira passada: parse de TODOS os XMLs sem filtros de CFOP/valor.
      // O pool completo eh necessario para que detectarEstornos veja as NFs
      // de estorno (que podem ter CFOP de entrada ou vProd=0) e consiga
      // marcar as NFs estornadas para exclusao.
      const allParsed: import('./types/nfe.ts').NfeData[] = [];
      for (const file of xmlFiles) {
        try {
          const text = await file.text();
          const parseResult = parseNfe(text, file.name);
          if (parseResult.success) {
            const chave = parseResult.data.chaveAcesso;
            if (existingChaves.has(chave) || chavesNesteLote.has(chave)) {
              duplicatedCount++;
            } else {
              existingChaves.add(chave);
              chavesNesteLote.add(chave);
              allParsed.push(parseResult.data);
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

      // FILTROS 1+2+3 — canceladas, estornos (sobre pool completo), sem TTD
      const { accepted: postFilters } = filtrarNfes(allParsed, canceladas);

      // Agora aplicar filtros de CFOP/valor sobre as NFs que passaram
      const accepted: import('./types/nfe.ts').NfeData[] = [];
      for (const nfe of postFilters) {
        if (!nfeHasValue(nfe.itens)) {
          zeroDiscarded++;
        } else if (!nfeHasAllowedCfop(nfe.itens)) {
          cfopDiscarded++;
        } else if (!nfeHasTaxableItems(nfe.itens)) {
          zeroDiscarded++;
        } else {
          accepted.push(nfe);
        }
      }

      // Validar apenas as NFs que passaram em todos os filtros
      const newResults = accepted.map(nfe =>
        validarNfe(nfe, config, cnpjInfoMap, REGRAS),
      );

      // Guardar dados brutos para reprocessamento
      setRawNfes(prev => [...prev, ...allParsed]);
      setCanceladasSet(prev => {
        const merged = new Set(prev);
        for (const c of canceladas) merged.add(c);
        return merged;
      });

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
    setRawNfes([]);
    setCanceladasSet(new Set());
    setParseErrors([]);
    setFilters(emptyFilters());
    setCnpjInfoMap(new Map());
    setDiscardedByCfop(0);
    setDiscardedZero(0);
    setDiscardedDuplicates(0);
    setEfdData(null);
    setEfdParseError(null);
    setCrossValidation(null);
  };

  const handleReprocess = useCallback(() => {
    if (rawNfes.length === 0) return;

    // Reaplicar TODOS os filtros desde os dados brutos
    const { accepted: postFilters } = filtrarNfes(rawNfes, canceladasSet);

    let cfopDisc = 0;
    let zeroDisc = 0;
    const accepted: import('./types/nfe.ts').NfeData[] = [];
    for (const nfe of postFilters) {
      if (!nfeHasValue(nfe.itens)) zeroDisc++;
      else if (!nfeHasAllowedCfop(nfe.itens)) cfopDisc++;
      else if (!nfeHasTaxableItems(nfe.itens)) zeroDisc++;
      else accepted.push(nfe);
    }

    const newResults = accepted.map(nfe =>
      validarNfe(nfe, config, cnpjInfoMap, REGRAS),
    );

    setResults(newResults);
    setDiscardedByCfop(cfopDisc);
    setDiscardedZero(zeroDisc);
    setDiscardedDuplicates(0);
  }, [rawNfes, canceladasSet, config, cnpjInfoMap]);

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
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Modern Sidebar layout */}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        buildTimestamp={commitHash}
        onViewIntent={preloadView}
      />

      <div className="flex-1 flex flex-col lg:ml-[260px]">
        {/* Modern TopBar layout */}
        <TopBar
          activeView={activeView}
          results={results}
          regras={REGRAS}
          config={config}
          cnpjInfoMap={cnpjInfoMap}
          onReprocess={handleReprocess}
          onClear={handleClear}
          crossValidation={crossValidation}
        />

        {/* Main Content Scrollable Area */}
        <main id="main-content" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-12">
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
        ) : activeView === 'regras' ? (
          <Suspense fallback={<ViewLoadingFallback />}>
            <RegrasPage />
          </Suspense>
        ) : activeView === 'cadastros' ? (
          <Suspense fallback={<ViewLoadingFallback />}>
            <CadastrosPage onConfigChanged={handleEmpresasUpdated} />
          </Suspense>
        ) : activeView === 'simulador' ? (
          <Suspense fallback={<ViewLoadingFallback />}>
            <SimuladorPage
              config={config}
              regras={REGRAS}
              empresas={empresas}
              cnpjInfoMap={cnpjInfoMap}
              onCnpjInfoLoaded={handleCnpjInfoLoaded}
            />
          </Suspense>
        ) : activeView === 'reconciliacao' ? (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ReconciliacaoPanel results={results} regras={REGRAS} config={config} />
          </Suspense>
        ) : activeView === 'apuracao_ttd' ? (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ApuracaoTTDPage results={results} regras={REGRAS} config={config} />
          </Suspense>
        ) : activeView === 'cross_validation' ? (
          <Suspense fallback={<ViewLoadingFallback />}>
            <CrossValidationPanel
              crossValidation={crossValidation}
              efdData={efdData}
              efdParseError={efdParseError}
              rawNfes={rawNfes}
              onFiles={handleFiles}
              isProcessing={isProcessing}
            />
          </Suspense>
        ) : (
          <div className="space-y-3">
            {/* Page Header */}
            <div className="mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">Auditor Fiscal</h2>
              <p className="text-muted-foreground mt-1 text-sm">Analise detalhada de conformidade e impostos indiretos.</p>
            </div>

            <DropZone onFiles={handleFiles} isProcessing={isProcessing} />

            <HistoricoPanel refreshKey={historicoRefreshKey} />

            <Dashboard
              results={results}
              uploadedTotal={results.length + discardedByCfop + discardedZero + discardedDuplicates + parseErrors.length}
              discardedByCfop={discardedByCfop}
              discardedZero={discardedZero}
              discardedDuplicates={discardedDuplicates}
              config={config}
              regras={REGRAS}
            />

            {results.length > 0 && (
              <>
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

                <AuditWorkspace
                  results={results}
                  filters={filters}
                  cnpjInfoMap={cnpjInfoMap}
                  regras={REGRAS}
                />

                <CenarioLegend regras={REGRAS} />
              </>
            )}
          </div>
        )}
      </main>

      </div>
    </div>
  );
}
