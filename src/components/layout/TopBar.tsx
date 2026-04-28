import { RefreshCw, Trash2, Search, Bell, HelpCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ExportButton } from '../ExportButton';
import { useAuth } from '@/auth/AuthContext';
import type { NfeValidation, CnpjInfo } from '../../types/validation';
import type { RegrasConfig } from '../../types/regras';
import type { AppConfig } from '../../types/config';
import type { CrossValidationResult } from '../../types/crossValidation';

function pickString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function deriveUserMeta(user: unknown): { name: string; role: string; initials: string } {
  const data = (user && typeof user === 'object' && 'data' in user)
    ? (user as { data: unknown }).data
    : user;
  const name =
    pickString(user, ['name', 'nome', 'fullName']) ||
    pickString(data, ['name', 'nome', 'fullName']) ||
    pickString(user, ['email', 'username']) ||
    pickString(data, ['email', 'username']) ||
    'Usuário';
  const role =
    pickString(user, ['role', 'cargo', 'perfil']) ||
    pickString(data, ['role', 'cargo', 'perfil']) ||
    'Auditor';
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '');
  return { name, role, initials: (initials || 'U').toUpperCase().slice(0, 2) };
}

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
  const { user } = useAuth();
  const meta = deriveUserMeta(user);
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 py-3 bg-card/85 backdrop-blur-[20px] border-b border-border">
      {/* Left side */}
      <div className="flex items-center gap-4 flex-1">
        <h2 className="text-lg font-bold text-[color:var(--prime-navy)] font-heading tracking-tight hidden sm:block">ICMS Auditor</h2>
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="text"
            placeholder="Buscar regras, cenarios ou NF-e\u2026"
            className="bg-muted border border-input rounded-lg pl-10 pr-4 py-1.5 text-sm w-64 lg:w-80 focus:ring-2 focus:ring-ring/30 focus:outline-none transition-shadow placeholder:text-muted-foreground"
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
              className="text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg px-2 sm:px-4 py-2"
              aria-label="Reprocessar notas"
            >
              <RefreshCw size={14} className="sm:mr-1.5" aria-hidden />
              <span className="hidden sm:inline">Reprocessar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg px-2 sm:px-4 py-2"
              aria-label="Limpar resultados"
            >
              <Trash2 size={14} className="sm:mr-1.5" aria-hidden />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
            <div className="h-6 w-[1px] bg-border mx-1 sm:mx-2" />
          </>
        )}

        <ExportButton results={results} regras={regras} config={config} cnpjInfoMap={cnpjInfoMap} crossValidation={crossValidation} />

        <div className="h-6 w-[1px] bg-border mx-1 sm:mx-2" />

        <IconButton aria-label="Notificações" className="text-muted-foreground hover:bg-muted">
          <Bell size={18} aria-hidden />
        </IconButton>
        <IconButton aria-label="Ajuda" className="text-muted-foreground hover:bg-muted">
          <HelpCircle size={18} aria-hidden />
        </IconButton>

        <div className="h-6 w-[1px] bg-border mx-1 sm:mx-2" />

        <div className="flex items-center gap-2 pr-1" aria-label="Usuário autenticado">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-[13px] shrink-0"
            style={{ background: 'var(--navy-700)' }}
            aria-hidden
          >
            {meta.initials}
          </div>
          <div className="hidden sm:block leading-tight min-w-0">
            <div className="text-[13px] font-semibold text-[color:var(--prime-navy)] truncate max-w-[140px]">
              {meta.name}
            </div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
              {meta.role}
            </div>
          </div>
          <ChevronDown size={14} className="text-muted-foreground hidden sm:block" aria-hidden />
        </div>
      </div>
    </header>
  );
}
