import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, RotateCcw } from 'lucide-react';

interface ImportExportPanelProps {
  onExport: () => string;
  onImport: (json: string) => Promise<void>;
  onRestaurar: () => Promise<void>;
}

export function ImportExportPanel({ onExport, onImport, onRestaurar }: ImportExportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  function handleExport() {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regras-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exportado com sucesso.');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await onImport(text);
      setStatus('Importado com sucesso.');
    } catch (err) {
      setStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleRestaurar() {
    if (!confirmRestore) {
      setConfirmRestore(true);
      return;
    }
    try {
      await onRestaurar();
      setStatus('Regras restauradas ao padrao.');
      setConfirmRestore(false);
    } catch (err) {
      setStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Exportar / Importar Regras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="text-xs gap-1.5">
              <Download size={13} /> Exportar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="text-xs gap-1.5">
              <Upload size={13} /> Importar JSON
            </Button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </div>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Restaurar Padrao</CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Remove todas as customizacoes e restaura as regras originais do sistema.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant={confirmRestore ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleRestaurar}
            className="text-xs gap-1.5"
          >
            <RotateCcw size={13} />
            {confirmRestore ? 'Confirmar Restauracao' : 'Restaurar Padrao'}
          </Button>
          {confirmRestore && (
            <p className="text-xs text-destructive mt-2">
              Esta acao ira substituir todas as regras atuais. Clique novamente para confirmar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
