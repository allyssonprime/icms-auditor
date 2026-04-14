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
    } else if (f.name.toLowerCase().endsWith('.txt')) {
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
        'relative w-full h-56 rounded-xl border-2 border-dashed border-[var(--outline-variant)] bg-surface-lowest flex flex-col items-center justify-center gap-4 transition-[border-color,background-color,transform,box-shadow] duration-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer overflow-hidden group',
        isDragOver && 'bg-primary/10 border-primary scale-[1.01] shadow-xl',
        isProcessing && 'opacity-50 pointer-events-none'
      )}
      aria-label="Arraste XMLs, ZIPs de NF-e ou EFD (.txt) ou clique para selecionar"
    >
      {/* Decorative dot pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,.zip,.txt"
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
        <div className="flex flex-col items-center gap-4 relative">
          {isDragOver ? (
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center animate-pulse">
              <FileUp size={28} className="text-primary" aria-hidden />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
              <Upload size={28} className="text-primary" aria-hidden />
            </div>
          )}
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              Arraste os XMLs, ZIPs ou EFD aqui
            </div>
            <div className="text-sm text-muted-foreground">
              ou clique para selecionar (aceita XMLs, ZIPs e EFD .txt)
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 bg-surface-container text-xs font-bold rounded-full text-muted-foreground">MAX 250MB</span>
            <span className="px-3 py-1 bg-surface-container text-xs font-bold rounded-full text-muted-foreground">NFe / CTe</span>
            <span className="px-3 py-1 bg-surface-container text-xs font-bold rounded-full text-muted-foreground">EFD / SPED</span>
          </div>
        </div>
      )}
    </div>
  );
}
