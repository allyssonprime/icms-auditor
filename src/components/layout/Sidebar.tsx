import { useState } from 'react';
import { ShieldCheck, Calculator, BookOpen, Settings, FileSpreadsheet, Receipt, Menu, X, HelpCircle, LogOut, FileSearch } from 'lucide-react';
import type { ActiveView } from '../../App';
import { useAuth } from '@/auth/AuthContext';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  buildTimestamp?: string;
}

export function Sidebar({ activeView, setActiveView, buildTimestamp = 'v1.0' }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();

  const menuItems = [
    { id: 'auditor' as ActiveView, label: 'Auditor', icon: ShieldCheck },
    { id: 'simulador' as ActiveView, label: 'Simulador', icon: Calculator },
    { id: 'regras' as ActiveView, label: 'Regras', icon: BookOpen },
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
      <div className="flex flex-col items-center px-2 mb-8">
        <img src="/icone-azul.png" alt="Prime" className="w-14 h-14 object-contain" />
        <h1 className="text-white text-lg font-bold tracking-tighter font-heading mt-2">ICMS Auditor</h1>
        <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Sovereign Analyst</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1 px-2" aria-label="Menu principal">
        {menuItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200 cursor-pointer font-heading tracking-tight ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400 font-semibold border-r-4 border-blue-500 rounded-l-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-400'} aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 space-y-1">
        <div className="border-t border-slate-800/50 pt-4 mb-4">
          <p className="text-[10px] text-slate-500 px-4 mb-1">Build</p>
          <p className="text-xs font-bold text-slate-400 px-4 truncate">{buildTimestamp}</p>
        </div>
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white transition-colors rounded-lg text-xs"
        >
          <HelpCircle size={16} aria-hidden />
          <span>Suporte</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white transition-colors rounded-lg text-xs mb-6"
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
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 bg-slate-950 text-white rounded-lg flex items-center justify-center shadow-lg"
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
        className={`fixed left-0 top-0 h-full w-64 bg-slate-950 flex flex-col pt-6 z-50 shadow-2xl shadow-slate-950/50 transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar (always visible) */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-slate-950 flex-col pt-6 z-50 shadow-2xl shadow-slate-950/50">
        {navContent}
      </aside>
    </>
  );
}
