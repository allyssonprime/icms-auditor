import { useState } from 'react';
import { CENARIOS } from '../engine/cenarios.ts';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


const CENARIO_GROUPS = [
  {
    title: 'Interestaduais',
    ids: ['A1', 'A2', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'],
  },
  {
    title: 'Internos (SC)',
    ids: ['B1', 'B2', 'B3', 'B4', 'B4-CAMEX', 'B5', 'B5-CAMEX', 'B6', 'B6-CAMEX', 'B7', 'B9', 'B10', 'B11', 'B12'],
  },
];

export function CenarioLegend() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="rounded-xl shadow-sm mb-6">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 h-auto rounded-xl"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen size={14} className="text-primary" />
          </div>
          Legenda de Cenarios
        </h2>
        <span className="text-muted-foreground">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </Button>

      {open && (
        <CardContent className="px-5 pb-4 pt-0">
          {CENARIO_GROUPS.map(group => (
            <div key={group.title} className="mb-4 last:mb-0">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {group.ids.map(id => {
                  const c = CENARIOS[id];
                  if (!c) return null;
                  return (
                    <div key={id} className="flex items-start gap-2 text-xs py-1">
                      <span className="font-mono font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded text-center shrink-0 min-w-[60px]">
                        {id}
                      </span>
                      <span className="text-foreground">{c.nome}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">
                        {c.aliquotasAceitas.length > 0
                          ? c.aliquotasAceitas.map(a => `${a}%`).join('/')
                          : 'dif.'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-3 pt-3 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Outros
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
              <div className="flex items-start gap-2 py-1">
                <span className="font-mono font-bold text-warning-700 bg-warning-50 px-1.5 py-0.5 rounded text-center shrink-0 min-w-[60px]">DEVOLUCAO</span>
                <span className="text-foreground">Devolucao de mercadoria (estornar CP)</span>
              </div>
              <div className="flex items-start gap-2 py-1">
                <span className="font-mono font-bold text-danger-700 bg-danger-50 px-1.5 py-0.5 rounded text-center shrink-0 min-w-[60px]">VEDADO</span>
                <span className="text-foreground">Item vedado (Decreto 2128 ou similar)</span>
              </div>
              <div className="flex items-start gap-2 py-1">
                <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded text-center shrink-0 min-w-[60px]">DESC.</span>
                <span className="text-foreground">Cenario nao identificado (verificar manual)</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
