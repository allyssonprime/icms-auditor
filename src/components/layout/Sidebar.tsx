import { useState } from 'react';
import { ShieldCheck, Calculator, BookOpen, Settings, FileSpreadsheet, Receipt, Menu, X, HelpCircle, LogOut, FileSearch } from 'lucide-react';
import type { ActiveView } from '../../App';
import { useAuth } from '@/auth/AuthContext';
import primeSidebarLogo from '@/assets/logo-dourada-branca.png';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  buildTimestamp?: string;
  onViewIntent?: (view: ActiveView) => void;
}

export function Sidebar({ activeView, setActiveView, buildTimestamp = 'v1.0', onViewIntent }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();

  const menuItems = [
    { id: 'auditor' as ActiveView, label: 'Auditor', icon: ShieldCheck },
    { id: 'simulador' as ActiveView, label: 'Simulador', icon: Calculator },
    { id: 'regras' as ActiveView, label: 'Regras TTD', icon: BookOpen },
    { id: 'reconciliacao' as ActiveView, label: 'Reconciliação', icon: FileSpreadsheet },
    { id: 'apuracao_ttd' as ActiveView, label: 'Apuração TTD', icon: Receipt },
    { id: 'cross_validation' as ActiveView, label: 'Validação EFD', icon: FileSearch },
    { id: 'cadastros' as ActiveView, label: 'Cadastros', icon: Settings },
  ];

  const handleNav = (view: ActiveView) => {
    setActiveView(view);
    setMobileOpen(false);
  };

  const navContent = (
    <>
      {/* Branding Logo Area */}
      <div className="flex items-center justify-center px-4 mb-8">
        <img src={primeSidebarLogo} alt="Prime Internacional" className="h-9 w-auto -translate-x-2 object-contain" />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1 px-2" aria-label="Menu principal">
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              onMouseEnter={() => onViewIntent?.(item.id)}
              onFocus={() => onViewIntent?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 cursor-pointer font-heading tracking-tight ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold rounded-lg'
                  : 'text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon size={18} className={isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/75'} aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 space-y-1">
        <div className="border-t border-sidebar-foreground/15 pt-4 mb-4">
          <p className="text-[10px] text-sidebar-foreground/60 px-4 mb-1">Build</p>
          <p className="text-xs font-bold text-sidebar-foreground/75 px-4 truncate">{buildTimestamp}</p>
        </div>
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-3 px-4 py-2 text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors rounded-lg text-xs"
        >
          <HelpCircle size={16} aria-hidden />
          <span>Suporte</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors rounded-lg text-xs mb-6"
        >
          <LogOut size={16} aria-hidden />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 bg-sidebar text-sidebar-foreground rounded-lg flex items-center justify-center shadow-lg"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile sidebar (slide-in) */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col pt-6 z-50 shadow-2xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-sidebar-foreground/75 hover:text-sidebar-foreground"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar (always visible) */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col pt-6 z-50 shadow-2xl">
        {navContent}
      </aside>
    </>
  );
}
