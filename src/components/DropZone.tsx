import { useState, useRef, useCallback } from 'react';
import { unzipSync } from 'fflate';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  isProcessing: boolean;
}

async function extractXmlsFromZip(zipFile: File): Promise<File[]> {
  const buffer = await zipFile.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));
  const xmlFiles: File[] = [];
  for (const [name, data] of Object.entries(unzipped)) {
    if (name.toLowerCase().endsWith('.xml')) {
      const ab = (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
      xmlFiles.push(new File([ab], name, { type: 'text/xml' }));
    }
  }
  return xmlFiles;
}

async function resolveFiles(rawFiles: File[]): Promise<File[]> {
  const result: File[] = [];
  for (const f of rawFiles) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      try {
        const xmls = await extractXmlsFromZip(f);
        result.push(...xmls);
      } catch (err) {
        console.warn(`[ZIP] Erro ao extrair ${f.name}:`, err);
      }
    } else if (f.name.toLowerCase().endsWith('.xml')) {
      result.push(f);
    }
  }
  return result;
}

export function DropZone({ onFiles, isProcessing }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = await resolveFiles(Array.from(e.dataTransfer.files));
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = await resolveFiles(Array.from(e.target.files ?? []));
    if (files.length > 0) onFiles(files);
    e.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative overflow-hidden rounded-2xl p-8 text-center cursor-pointer transition-all duration-300',
        isDragOver
          ? 'bg-primary/10 ring-2 ring-primary ring-offset-2 scale-[1.01]'
          : 'bg-gradient-to-br from-primary-50 via-white to-primary-100/50 hover:from-primary-100/80 hover:to-primary-50 border border-primary-200/40 hover:border-primary-300/60 hover:shadow-lg',
        isProcessing && 'opacity-50 pointer-events-none'
      )}
      aria-label="Arraste XMLs ou ZIPs de NF-e ou clique para selecionar"
    >
      {/* Decorative background circles */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/5 pointer-events-none" />
      <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-primary/5 pointer-events-none" />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,.zip"
        className="hidden"
        onClick={e => e.stopPropagation()}
        onChange={handleInputChange}
        aria-hidden
      />
      {isProcessing ? (
        <div className="flex flex-col items-center gap-3 relative">
          <Loader2 size={36} className="animate-spin text-primary" aria-hidden />
          <div className="text-lg font-semibold text-foreground">Processando...</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 relative">
          {isDragOver ? (
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center animate-pulse">
              <FileUp size={32} className="text-primary" aria-hidden />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md">
              <Upload size={28} className="text-white" aria-hidden />
            </div>
          )}
          <div>
            <div className="text-base font-semibold text-foreground">
              Arraste os XMLs ou ZIPs de NF-e aqui
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ou clique para selecionar (aceita XMLs e arquivos ZIP)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
