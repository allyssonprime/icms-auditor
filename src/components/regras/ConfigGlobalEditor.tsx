import { useState } from 'react';
import type { RegrasGlobal } from '../../types/regras.ts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChipEditor } from './ChipEditor.tsx';

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

interface ConfigGlobalEditorProps {
  global: RegrasGlobal;
  onSave: (global: RegrasGlobal) => void;
}

export function ConfigGlobalEditor({ global: initial, onSave }: ConfigGlobalEditorProps) {
  const [config, setConfig] = useState<RegrasGlobal>(structuredClone(initial));
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof RegrasGlobal>(key: K, value: RegrasGlobal[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateUfAliquota(uf: string, value: string) {
    const next = { ...config.ufAliquotas };
    if (value === '' || value === '7') {
      delete next[uf]; // 7% e o default, nao precisa salvar
    } else {
      next[uf] = Number(value);
    }
    update('ufAliquotas', next);
  }

  return (
    <div className="space-y-4">
      {/* UF Aliquotas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Aliquotas Interestaduais por UF</CardTitle>
          <p className="text-[10px] text-muted-foreground">UFs sem valor definido usam 7% como padrao</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {UFS.map(uf => (
              <div key={uf} className="flex items-center gap-1">
                <span className="text-xs font-semibold w-6">{uf}</span>
                <Input
                  type="number"
                  step="any"
                  value={config.ufAliquotas[uf] ?? ''}
                  onChange={e => updateUfAliquota(uf, e.target.value)}
                  placeholder="7"
                  className="text-xs h-7 w-16"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aliquotas Internas Validas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Aliquotas Internas Validas</CardTitle>
        </CardHeader>
        <CardContent>
          <ChipEditor
            values={config.aliquotasInternasValidas}
            onChange={v => update('aliquotasInternasValidas', v as number[])}
            type="number"
            placeholder="Ex: 7"
          />
        </CardContent>
      </Card>

      {/* CFOPs Especiais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">CFOPs Especiais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChipEditor values={config.cfopsDevolucao} onChange={v => update('cfopsDevolucao', v as string[])} label="CFOPs Devolucao" placeholder="Ex: 6201" />
          <ChipEditor values={config.cfopsTransferencia} onChange={v => update('cfopsTransferencia', v as string[])} label="CFOPs Transferencia" placeholder="Ex: 5152" />
        </CardContent>
      </Card>

      {/* Fundos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Fundos e Cenarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Taxa de Fundos: 0,4% (fixo)</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cenarios com fundos=0 ou carga efetiva N/A nao cobram fundos automaticamente.
          </p>
        </CardContent>
      </Card>

      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onSave(config); setDirty(false); }} className="text-xs">
            Salvar Configuracoes
          </Button>
        </div>
      )}
    </div>
  );
}
