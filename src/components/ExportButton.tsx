import type { NfeValidation } from '../types/validation.ts';
import { exportToExcel } from '../utils/exportExcel.ts';

interface ExportButtonProps {
  results: NfeValidation[];
}

export function ExportButton({ results }: ExportButtonProps) {
  if (results.length === 0) return null;

  return (
    <button
      onClick={() => exportToExcel(results)}
      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
    >
      Exportar Excel
    </button>
  );
}
