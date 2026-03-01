import { useState, useCallback, useEffect } from 'react';
import type { NfeValidation, ActiveFilters, StatusType } from './types/validation.ts';
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
  };
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

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);
      const newResults: NfeValidation[] = [];
      const newErrors: ParseError[] = [];

      for (const file of files) {
        try {
          const text = await file.text();
          const parseResult = parseNfe(text, file.name);
          if (parseResult.success) {
            newResults.push(validarNfe(parseResult.data, config));
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
      setIsProcessing(false);
    },
    [config],
  );

  const handleClear = () => {
    setResults([]);
    setParseErrors([]);
    setFilters(emptyFilters());
  };

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    setShowConfig(false);
    if (results.length > 0) {
      const revalidated = results.map(r => validarNfe(r.nfe, newConfig));
      setResults(revalidated);
    }
  };

  const handleToggleFilter = useCallback((type: keyof ActiveFilters, value: string | number) => {
    setFilters(prev => {
      const next = { ...prev };
      if (type === 'aliquota') {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              PRIME NF-e Auditor v2
            </h1>
            <p className="text-xs text-gray-500">TTD 410/SC</p>
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
          <Dashboard results={results} />
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
            />

            <CnpjLookupPanel results={results} />

            <NfeListView results={results} filters={filters} />
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
