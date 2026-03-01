import { useState, useRef, useCallback } from 'react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  isProcessing: boolean;
}

export function DropZone({ onFiles, isProcessing }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.name.toLowerCase().endsWith('.xml'),
      );
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f =>
      f.name.toLowerCase().endsWith('.xml'),
    );
    if (files.length > 0) onFiles(files);
    e.target.value = '';
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragOver
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-blue-400 bg-white'
        }
        ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml"
        className="hidden"
        onChange={handleInputChange}
      />
      {isProcessing ? (
        <div>
          <div className="text-lg font-medium text-gray-600">Processando...</div>
        </div>
      ) : (
        <div>
          <div className="text-4xl mb-3 text-gray-400">&#128462;</div>
          <div className="text-lg font-medium text-gray-700">
            Arraste XMLs de NF-e aqui
          </div>
          <div className="text-sm text-gray-500 mt-1">
            ou clique para selecionar (aceita multiplos arquivos)
          </div>
        </div>
      )}
    </div>
  );
}
