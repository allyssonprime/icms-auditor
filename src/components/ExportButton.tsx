import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import type { RegrasConfig } from '../types/regras.ts';
import type { AppConfig } from '../types/config.ts';
import type { CrossValidationResult } from '../types/crossValidation.ts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  results: NfeValidation[];
  regras: RegrasConfig;
  config: AppConfig;
  cnpjInfoMap?: Map<string, CnpjInfo>;
  crossValidation?: CrossValidationResult | null;
}

export function ExportButton({ results, regras, config, cnpjInfoMap, crossValidation }: ExportButtonProps) {
  if (results.length === 0) return null;

  const handleExport = async () => {
    const { exportToExcel } = await import('../utils/exportExcel.ts');
    await exportToExcel(results, regras, config, cnpjInfoMap, crossValidation ?? undefined);
  };

  return (
    <Button
      onClick={() => void handleExport()}
      size="sm"
      aria-label="Exportar resultados para Excel"
    >
      <Download size={15} aria-hidden />
      Exportar
    </Button>
  );
}
