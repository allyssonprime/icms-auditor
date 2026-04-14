import { RefreshCw, Trash2, Search, Bell, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '../ExportButton';
import type { NfeValidation, CnpjInfo } from '../../types/validation';
import type { RegrasConfig } from '../../types/regras';
import type { AppConfig } from '../../types/config';
import type { CrossValidationResult } from '../../types/crossValidation';

interface TopBarProps {
  activeView: string;
  results: NfeValidation[];
  regras: RegrasConfig;
  config: AppConfig;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  onReprocess: () => void;
  onClear: () => void;
  onSearchChange?: (text: string) => void;
  crossValidation?: CrossValidationResult | null;
}

export function TopBar({ activeView, results, regras, config, cnpjInfoMap, onReprocess, onClear, onSearchChange, crossValidation }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-3 bg-[#faf8ff]/80 backdrop-blur-[20px] border-b border-[var(--outline-variant)]/15">
      {/* Left side */}
      <div className="flex items-center gap-4 flex-1">
        <h2 className="text-lg font-bold text-on-surface font-heading tracking-tight hidden sm:block">ICMS Auditor</h2>
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="text"
            placeholder="Buscar regras, cenarios ou NF-e\u2026"
            className="bg-white/50 border-none rounded-lg pl-10 pr-4 py-1.5 text-sm w-64 lg:w-80 focus:ring-2 focus:ring-primary/20 transition-shadow placeholder:text-slate-400"
            onChange={e => onSearchChange?.(e.target.value)}
            aria-label="Busca global"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {activeView === 'auditor' && results.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReprocess}
              className="text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg px-2 sm:px-4 py-2"
              aria-label="Reprocessar notas"
            >
              <RefreshCw size={14} className="sm:mr-1.5" aria-hidden />
              <span className="hidden sm:inline">Reprocessar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg px-2 sm:px-4 py-2"
              aria-label="Limpar resultados"
            >
              <Trash2 size={14} className="sm:mr-1.5" aria-hidden />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
            <div className="h-6 w-[1px] bg-slate-200 mx-1 sm:mx-2" />
          </>
        )}

        <ExportButton results={results} regras={regras} config={config} cnpjInfoMap={cnpjInfoMap} crossValidation={crossValidation} />

        <div className="h-6 w-[1px] bg-slate-200 mx-1 sm:mx-2" />

        <button
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Notificacoes"
        >
          <Bell size={18} aria-hidden />
        </button>
        <button
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Ajuda"
        >
          <HelpCircle size={18} aria-hidden />
        </button>
      </div>
    </header>
  );
}
