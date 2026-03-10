import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters.ts';
import { listarAuditorias, excluirAuditoria } from '../firebase/auditoriaService.ts';
import type { AuditoriaDoc } from '../types/auditoria.ts';
import { History, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HistoricoPanelProps {
  refreshKey?: number;
}

const statusBadge: Record<string, string> = {
  OK: 'bg-success-100 text-success-700',
  ALERTA: 'bg-warning-100 text-warning-700',
  ERRO: 'bg-danger-100 text-danger-700',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function HistoricoPanel({ refreshKey }: HistoricoPanelProps) {
  const [auditorias, setAuditorias] = useState<AuditoriaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [limparTodos, setLimparTodos] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listarAuditorias(10);
    setAuditorias(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  const handleExcluir = async (id: string) => {
    setExcluindo(id);
    await excluirAuditoria(id);
    setAuditorias(prev => prev.filter(a => a.id !== id));
    setExcluindo(null);
  };

  const handleLimparTudo = async () => {
    if (auditorias.length === 0) return;
    setLimparTodos(true);
    for (const a of auditorias) {
      await excluirAuditoria(a.id);
    }
    setAuditorias([]);
    setLimparTodos(false);
  };

  if (loading) {
    return (
      <Card className="mb-6 shadow-sm">
        <CardContent className="py-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin text-primary" aria-hidden />
            Carregando historico...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (auditorias.length === 0) return null;

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <History size={14} className="text-primary" aria-hidden />
          </div>
          Auditorias Anteriores
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLimparTudo}
          disabled={limparTodos}
          aria-label="Limpar todo o historico"
          className="text-xs"
        >
          <Trash2 size={13} aria-hidden />
          {limparTodos ? 'Limpando...' : 'Limpar tudo'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {auditorias.map(a => (
          <div
            key={a.id}
            className="flex items-center justify-between border border-border rounded-xl px-4 py-3 hover:bg-muted/50 hover:shadow-xs transition-all duration-150"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">{a.totalNfes} NF-es</span>
                <span className="w-px h-3.5 bg-border" />
                <span className="text-muted-foreground text-xs">{formatDate(a.criadoEm)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                <Badge className={cn('border-transparent rounded-md text-[10px]', statusBadge.OK)}>{a.resumo.nfesOk} OK</Badge>
                {a.resumo.nfesAlerta > 0 && (
                  <Badge className={cn('border-transparent rounded-md text-[10px]', statusBadge.ALERTA)}>{a.resumo.nfesAlerta} Alerta</Badge>
                )}
                {a.resumo.nfesErro > 0 && (
                  <Badge className={cn('border-transparent rounded-md text-[10px]', statusBadge.ERRO)}>{a.resumo.nfesErro} Erro</Badge>
                )}
                <span className="w-px h-3 bg-border" />
                <span className="text-muted-foreground font-mono tabular-nums">BC: {formatCurrency(a.resumo.totalBC)}</span>
                <span className="text-muted-foreground font-mono tabular-nums">Total: {formatCurrency(a.resumo.totalRecolherComFundos)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExcluir(a.id)}
                disabled={excluindo === a.id}
                className="text-muted-foreground hover:text-danger-600 hover:bg-danger-50 h-8 text-xs"
              >
                <Trash2 size={13} aria-hidden />
                {excluindo === a.id ? '...' : 'Excluir'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
