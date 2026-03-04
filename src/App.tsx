import { useState, useCallback, useEffect } from 'react';
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
import { ConfigPanel } from './components/ConfigPanel.tsx';
import { GroupingPanel } from './components/GroupingPanel.tsx';
import { NfeListView } from './components/NfeListView.tsx';
import { CnpjLookupPanel } from './components/CnpjLookupPanel.tsx';
import { CenarioLegend } from './components/CenarioLegend.tsx';

const STORAGE_KEY = 'prime-nfe-auditor-config';
const ALLOWED_CFOPS = new Set(['5949', '6949', '5102', '6102']);

function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AppConfig;
  } catch { /* ignore */ }
  return getDefaultConfig();
}

function saveConfig(config: AppConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

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

/** Check if NF-e has at least one item with allowed CFOP */
function nfeHasAllowedCfop(items: Array<{ cfop: string }>): boolean {
  return items.some(item => ALLOWED_CFOPS.has(item.cfop));
}

/** Check if NF-e has non-zero total values */
function nfeHasNonZeroTotal(items: Array<{ vBC: number; vICMS: number; vProd: number }>): boolean {
  return items.some(item => item.vBC > 0 || item.vICMS > 0 || item.vProd > 0);
}

/** Extract XML files from a ZIP archive */
async function extractXmlsFromZip(file: File): Promise<File[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const xmlFiles: File[] = [];
  const entries = Object.entries(zip.files);
  for (const [name, entry] of entries) {
    if (!entry.dir && name.toLowerCase().endsWith('.xml')) {
      const blob = await entry.async('blob');
      xmlFiles.push(new File([blob], name, { type: 'text/xml' }));
    }
  }
  return xmlFiles;
}

interface ParseError {
  fileName: string;
  error: string;
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [results, setResults] = useState<NfeValidation[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [filters, setFilters] = useState<ActiveFilters>(emptyFilters);
  const [cnpjInfoMap, setCnpjInfoMap] = useState<Map<string, CnpjInfo>>(new Map());
  const [discardedByCfop, setDiscardedByCfop] = useState(0);

  // Save config and re-validate all NF-es when config or cnpjInfoMap changes
  useEffect(() => {
    saveConfig(config);
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
      let discarded = 0;

      // Expand ZIP files into XML files
      const allFiles: File[] = [];
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          try {
            const extracted = await extractXmlsFromZip(file);
            allFiles.push(...extracted);
          } catch (e) {
            newErrors.push({ fileName: file.name, error: `Erro ao abrir ZIP: ${e instanceof Error ? e.message : String(e)}` });
          }
        } else {
          allFiles.push(file);
        }
      }

      for (const file of allFiles) {
        try {
          const text = await file.text();
          const parseResult = parseNfe(text, file.name);
          if (parseResult.success) {
            if (!nfeHasAllowedCfop(parseResult.data.itens)) {
              discarded++;
            } else if (!nfeHasNonZeroTotal(parseResult.data.itens)) {
              discarded++;
            } else {
              newResults.push(validarNfe(parseResult.data, config, cnpjInfoMap));
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
      setDiscardedByCfop(prev => prev + discarded);
      setIsProcessing(false);
    },
    [config, cnpjInfoMap],
  );

  const handleClear = () => {
    setResults([]);
    setParseErrors([]);
    setFilters(emptyFilters());
    setCnpjInfoMap(new Map());
    setDiscardedByCfop(0);
  };

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    setShowConfig(false);
  };

  const handleCnpjInfoLoaded = useCallback((info: CnpjInfo) => {
    setCnpjInfoMap(prev => new Map(prev).set(info.cnpj, info));

    const needsSN = info.simplesOptante === true;
    const needsIndustrial = info.isIndustrial;

    if (needsSN || needsIndustrial) {
      setConfig(prev => {
        let changed = false;
        const next = { ...prev };
        if (needsSN && !prev.listaSN.includes(info.cnpj)) {
          next.listaSN = [...prev.listaSN, info.cnpj];
          changed = true;
        }
        if (needsIndustrial && !prev.listaIndustriais.includes(info.cnpj)) {
          next.listaIndustriais = [...prev.listaIndustriais, info.cnpj];
          changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, []);

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              PRIME NF-e Auditor v2
            </h1>
            <p className="text-xs text-gray-500">TTD 410/SC — Atualizado em {__BUILD_TIMESTAMP__}</p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton results={results} />
            {results.length > 0 && (
              <button
                onClick={handleClear}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Limpar
              </button>
            )}
            <button
              onClick={() => setShowConfig(true)}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Configurar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <DropZone onFiles={handleFiles} isProcessing={isProcessing} />

        {parseErrors.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">
              Erros de leitura:
            </h3>
            {parseErrors.map((pe, idx) => (
              <div key={idx} className="text-xs text-red-600">
                <b>{pe.fileName}:</b> {pe.error}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Dashboard results={results} discardedByCfop={discardedByCfop} config={config} />
        </div>

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

            <CnpjLookupPanel results={results} onCnpjInfoLoaded={handleCnpjInfoLoaded} />

            <NfeListView results={results} filters={filters} cnpjInfoMap={cnpjInfoMap} />
          </>
        )}
      </main>

      {showConfig && (
        <ConfigPanel
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}
