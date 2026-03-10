import type { NfeValidation } from '../types/validation.ts';
import { exportToExcel } from '../utils/exportExcel.ts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  results: NfeValidation[];
}

export function ExportButton({ results }: ExportButtonProps) {
  if (results.length === 0) return null;

  return (
    <Button
      onClick={() => exportToExcel(results)}
      size="sm"
      aria-label="Exportar resultados para Excel"
    >
      <Download size={15} aria-hidden />
      Exportar
    </Button>
  );
}
