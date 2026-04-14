import { useState } from 'react';
import type { GrupoRegra, CondicoesCenario, ValoresEsperados, Ramificacao, TipoDest, TipoOperacao, ListaEspecial, CfopMatch, AplicacaoProduto } from '../../types/regras.ts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChipEditor } from './ChipEditor.tsx';
import { Trash2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// --- Constantes para selects ---

const TIPO_DEST_OPTIONS: { value: TipoDest; label: string }[] = [
  { value: 'contribuinte', label: 'Contribuinte' },
  { value: 'sn', label: 'Simples Nacional' },
  { value: 'pj_nc', label: 'PJ Nao Contribuinte' },
  { value: 'pf', label: 'Pessoa Fisica' },
];

const LISTA_ESPECIAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'vedacao25a', label: 'Vedacao 25a (Pro-Emprego / Diferimento)' },
  { value: 'vedacao25b', label: 'Vedacao 25b (Textil / Confeccoes art.15 XXXIX)' },
  { value: 'cd', label: 'CD Exclusivo (Booster)' },
  { value: 'industrial', label: 'Industrial (MP c/ mudanca NCM)' },
];

const CST_TRIBUTACAO_OPTIONS: { value: string; label: string }[] = [
  { value: '00', label: '00 — Tributado integralmente' },
  { value: '10', label: '10 — Tributado com ST' },
  { value: '20', label: '20 — Com reducao de BC' },
  { value: '51', label: '51 — Diferimento parcial' },
  { value: '70', label: '70 — Com reducao + ST' },
  { value: '90', label: '90 — Outras' },
];

const CST_ORIGEM_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 — Importacao direta (com similar nacional)' },
  { value: '6', label: '6 — Sem similar nacional (CAMEX)' },
  { value: '7', label: '7 — Adquirido merc. interno (sem similar)' },
];

const CARGA_EFETIVA_OPTIONS: { value: string; label: string }[] = [
  { value: '-1', label: 'N/A — TTD nao se aplica' },
  { value: '0', label: '0% — Nenhuma (nao recolhe)' },
  { value: '0.6', label: '0,6% — Cobre/aco interestadual' },
  { value: '1', label: '1% — Padrao interestadual' },
  { value: '2.1', label: '2,1% — CAMEX' },
  { value: '3.6', label: '3,6% — Industrializacao' },
];

const CFOP_GRUPOS: { label: string; cfops: string[] }[] = [
  { label: 'Internas (5101-5107)', cfops: ['5101', '5102', '5106', '5107'] },
  { label: 'Interestaduais (6101-6108)', cfops: ['6101', '6102', '6106', '6107', '6108'] },
  { label: 'Transf. Interna (5152/5155)', cfops: ['5152', '5155'] },
  { label: 'Transf. Interestadual (6152/6155)', cfops: ['6152', '6155'] },
];

const APLICACAO_OPTIONS: { value: string; label: string }[] = [
  { value: 'any', label: 'Qualquer aplicacao' },
  { value: 'revenda', label: 'Revenda' },
  { value: 'industrializacao', label: 'Industrializacao' },
  { value: 'uso_consumo', label: 'Uso / Consumo' },
  { value: 'ativo_permanente', label: 'Ativo Permanente' },
];

// --- Componentes auxiliares ---

interface CstSelectorProps {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
}

function ToggleButtonGroup({ values, onChange, label, options }: CstSelectorProps & { options: { value: string; label: string }[] }) {
  function toggle(code: string) {
    if (values.includes(code)) {
      onChange(values.filter(v => v !== code));
    } else {
      onChange([...values, code]);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-2 py-1 rounded text-[10px] border transition-colors cursor-pointer ${
              values.includes(opt.value)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface CargaEfetivaSelectProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: 'sm' | 'md';
}

function CargaEfetivaSelect({ value, onChange, label, size = 'md' }: CargaEfetivaSelectProps) {
  return (
    <div>
      <Label className={size === 'sm' ? 'text-[10px] text-muted-foreground' : 'text-xs'}>{label}</Label>
      <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
        <SelectTrigger className={size === 'sm' ? 'h-7 text-xs' : 'h-8 text-xs'}><SelectValue /></SelectTrigger>
        <SelectContent>
          {CARGA_EFETIVA_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface CfopEditorProps {
  cfops: string[];
  onChange: (cfops: string[]) => void;
}

function CfopEditor({ cfops, onChange }: CfopEditorProps) {
  const aceitarQualquer = cfops.length === 0;

  function toggleAceitarQualquer() {
    if (aceitarQualquer) {
      onChange(['5101', '5102', '5106', '5107']);
    } else {
      onChange([]);
    }
  }

  function addGrupo(grupoCfops: string[]) {
    const merged = new Set([...cfops, ...grupoCfops]);
    onChange([...merged]);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">CFOPs Esperados</Label>
      <div className="flex items-center gap-2 mb-1">
        <Checkbox checked={aceitarQualquer} onCheckedChange={toggleAceitarQualquer} id="cfop-any" />
        <Label htmlFor="cfop-any" className="text-xs cursor-pointer">Aceitar qualquer CFOP</Label>
      </div>
      {!aceitarQualquer && (
        <>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {CFOP_GRUPOS.map(g => (
              <Button
                key={g.label}
                variant="outline"
                size="sm"
                type="button"
                onClick={() => addGrupo(g.cfops)}
                className="h-6 text-[10px] px-2"
              >
                + {g.label}
              </Button>
            ))}
          </div>
          <ChipEditor values={cfops} onChange={v => onChange(v as string[])} placeholder="CFOP (ex: 5101)" />
        </>
      )}
      {aceitarQualquer && (
        <p className="text-[10px] text-muted-foreground">Qualquer CFOP da operacao sera aceito sem alerta.</p>
      )}
    </div>
  );
}

// --- Editor principal ---

interface GrupoEditorProps {
  grupo: GrupoRegra;
  onSave: (grupo: GrupoRegra) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function GrupoEditor({ grupo: initial, onSave, onCancel, onDelete }: GrupoEditorProps) {
  const [grupo, setGrupo] = useState<GrupoRegra>(structuredClone(initial));

  function updateField<K extends keyof GrupoRegra>(key: K, value: GrupoRegra[K]) {
    setGrupo(prev => ({ ...prev, [key]: value }));
  }

  function updateCondicao<K extends keyof CondicoesCenario>(key: K, value: CondicoesCenario[K]) {
    setGrupo(prev => ({ ...prev, condicoes: { ...prev.condicoes, [key]: value } }));
  }

  function updateValoresBase<K extends keyof ValoresEsperados>(key: K, value: ValoresEsperados[K]) {
    setGrupo(prev => ({ ...prev, valoresBase: { ...prev.valoresBase, [key]: value } }));
  }

  function updateRamificacao(index: number, ram: Ramificacao) {
    setGrupo(prev => {
      const rams = [...prev.ramificacoes];
      rams[index] = ram;
      return { ...prev, ramificacoes: rams };
    });
  }

  function removeRamificacao(index: number) {
    setGrupo(prev => ({
      ...prev,
      ramificacoes: prev.ramificacoes.filter((_, i) => i !== index),
    }));
  }

  function toggleTipoDest(td: TipoDest) {
    const current = grupo.condicoes.tipoDest ?? [];
    const next = current.includes(td) ? current.filter(v => v !== td) : [...current, td];
    updateCondicao('tipoDest', next.length > 0 ? next : undefined);
  }

  return (
    <div className="space-y-4">
      {/* Identificacao */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Identificacao</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">ID</Label>
            <Input value={grupo.id} onChange={e => updateField('id', e.target.value)} className="text-xs h-8" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Nome</Label>
            <Input value={grupo.nome} onChange={e => updateField('nome', e.target.value)} className="text-xs h-8" />
          </div>
          <div>
            <Label className="text-xs">Prioridade</Label>
            <Input type="number" value={grupo.prioridade} onChange={e => updateField('prioridade', Number(e.target.value))} className="text-xs h-8" />
          </div>
          <div className="col-span-4">
            <Label className="text-xs">Descricao</Label>
            <Input value={grupo.descricao} onChange={e => updateField('descricao', e.target.value)} className="text-xs h-8" />
          </div>
          <div className="flex items-center gap-2 col-span-4">
            <Checkbox checked={grupo.ativo} onCheckedChange={v => updateField('ativo', !!v)} id="ativo" />
            <Label htmlFor="ativo" className="text-xs cursor-pointer">Ativo</Label>
          </div>
        </CardContent>
      </Card>

      {/* Condicoes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Condicoes de Classificacao</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Operacao</Label>
            <Select value={grupo.condicoes.operacao ?? 'any'} onValueChange={v => updateCondicao('operacao', v === 'any' ? undefined : v as TipoOperacao)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="interestadual">Interestadual</SelectItem>
                <SelectItem value="interna">Interna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">CAMEX</Label>
            <Select value={grupo.condicoes.camex === undefined ? 'any' : grupo.condicoes.camex ? 'true' : 'false'} onValueChange={v => updateCondicao('camex', v === 'any' ? undefined : v === 'true')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cobre/Aco</Label>
            <Select value={grupo.condicoes.cobreAco === undefined ? 'any' : grupo.condicoes.cobreAco ? 'true' : 'false'} onValueChange={v => updateCondicao('cobreAco', v === 'any' ? undefined : v === 'true')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tem ST</Label>
            <Select value={grupo.condicoes.temST === undefined ? 'any' : grupo.condicoes.temST ? 'true' : 'false'} onValueChange={v => updateCondicao('temST', v === 'any' ? undefined : v === 'true')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Lista Especial</Label>
            <Select value={grupo.condicoes.listaEspecial ?? 'none'} onValueChange={v => updateCondicao('listaEspecial', v === 'none' ? undefined : v as ListaEspecial)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LISTA_ESPECIAL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">CFOP Match</Label>
            <Select value={grupo.condicoes.cfopMatch ?? 'none'} onValueChange={v => updateCondicao('cfopMatch', v === 'none' ? undefined : v as CfopMatch)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="devolucao">Devolucao</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Aplicacao</Label>
            <Select value={grupo.condicoes.aplicacao ?? 'any'} onValueChange={v => updateCondicao('aplicacao', v === 'any' ? undefined : v as AplicacaoProduto)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {APLICACAO_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-full">
            <Label className="text-xs mb-1.5 block">Tipo Destinatario (OR)</Label>
            <div className="flex flex-wrap gap-3">
              {TIPO_DEST_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <Checkbox
                    checked={(grupo.condicoes.tipoDest ?? []).includes(opt.value)}
                    onCheckedChange={() => toggleTipoDest(opt.value)}
                    id={`td-${opt.value}`}
                  />
                  <Label htmlFor={`td-${opt.value}`} className="text-xs cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Valores Base */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            Valores Base (compartilhados)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size={13} className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Template compartilhado por todas as ramificacoes. Cada ramificacao herda estes valores e pode sobrescrever campos especificos. Se nenhuma ramificacao casar com as condicoes da NF-e, o grupo inteiro nao dispara.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChipEditor values={grupo.valoresBase.aliquotasAceitas} onChange={v => updateValoresBase('aliquotasAceitas', v as number[])} type="number" label="Aliquotas Aceitas (%)" placeholder="Ex: 4" />
            <div>
              <Label className="text-xs">Ref TTD</Label>
              <Input value={grupo.valoresBase.refTTD} onChange={e => updateValoresBase('refTTD', e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleButtonGroup
              values={grupo.valoresBase.cstEsperado}
              onChange={v => updateValoresBase('cstEsperado', v)}
              label="CST Tributacao Esperado (2 ultimos digitos)"
              options={CST_TRIBUTACAO_OPTIONS}
            />
            <div>
              <Label className="text-xs text-muted-foreground">CST Origem (1o digito) — referencia</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CST_ORIGEM_OPTIONS.map(opt => (
                  <Badge key={opt.value} variant="outline" className="text-[10px]">{opt.label}</Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Origem 6 = sem similar → item tratado como CAMEX automaticamente pelo classificador.
              </p>
            </div>
          </div>

          <CfopEditor cfops={grupo.valoresBase.cfopsEsperados} onChange={v => updateValoresBase('cfopsEsperados', v)} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CargaEfetivaSelect
              value={grupo.valoresBase.cargaEfetiva}
              onChange={v => {
                updateValoresBase('cargaEfetiva', v);
                if (v < 0) updateValoresBase('fundos', 0);
                else if (grupo.valoresBase.fundos === 0 && v >= 0) updateValoresBase('fundos', 0.4);
              }}
              label="Carga Efetiva do TTD"
            />
            <div className="flex items-center gap-2 pt-5">
              <Badge variant="secondary" className="text-xs">
                {grupo.valoresBase.cargaEfetiva < 0 ? 'Fundos: N/A' : 'Fundos: 0,4% (fixo)'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox checked={grupo.valoresBase.temCP} onCheckedChange={v => updateValoresBase('temCP', !!v)} id="temCP" />
              <Label htmlFor="temCP" className="text-xs cursor-pointer">Credito Presumido</Label>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox checked={grupo.valoresBase.temDiferimentoParcial} onCheckedChange={v => updateValoresBase('temDiferimentoParcial', !!v)} id="temDif" />
              <Label htmlFor="temDif" className="text-xs cursor-pointer">Diferimento Parcial</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ramificacoes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ramificacoes ({grupo.ramificacoes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {grupo.ramificacoes.map((ram, index) => (
            <RamificacaoEditor
              key={index}
              ram={ram}
              index={index}
              onChange={r => updateRamificacao(index, r)}
              onRemove={() => removeRamificacao(index)}
              canRemove={grupo.ramificacoes.length > 1}
            />
          ))}
        </CardContent>
      </Card>

      {/* Acoes — sticky no rodape */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-3 px-1 -mx-1 flex gap-2 justify-end z-10">
        {onDelete && (
          <Button variant="destructive" size="sm" onClick={onDelete} className="text-xs gap-1 mr-auto">
            <Trash2 size={13} /> Excluir Grupo
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">Voltar</Button>
        <Button size="sm" onClick={() => onSave(grupo)} className="text-xs">Salvar</Button>
      </div>
    </div>
  );
}

// --- Ramificacao sub-editor ---

interface RamificacaoEditorProps {
  ram: Ramificacao;
  index: number;
  onChange: (ram: Ramificacao) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function RamificacaoEditor({ ram, index, onChange, onRemove, canRemove }: RamificacaoEditorProps) {
  function update<K extends keyof Ramificacao>(key: K, value: Ramificacao[K]) {
    onChange({ ...ram, [key]: value });
  }

  function updateOverride<K extends keyof ValoresEsperados>(key: K, value: ValoresEsperados[K]) {
    onChange({ ...ram, override: { ...ram.override, [key]: value } });
  }

  function updateCondicaoExtra<K extends keyof CondicoesCenario>(key: K, value: CondicoesCenario[K]) {
    onChange({ ...ram, condicaoExtra: { ...ram.condicaoExtra, [key]: value } });
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
        <div className="grid grid-cols-3 gap-2 flex-1">
          <div>
            <Input value={ram.cenarioId} onChange={e => update('cenarioId', e.target.value)} placeholder="ID (ex: A1)" className="text-xs h-7" />
          </div>
          <div>
            <Input value={ram.nome} onChange={e => update('nome', e.target.value)} placeholder="Nome" className="text-xs h-7" />
          </div>
          <div>
            <Input type="number" value={ram.prioridade} onChange={e => update('prioridade', Number(e.target.value))} placeholder="Prio" className="text-xs h-7" />
          </div>
        </div>
        {canRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-7 w-7 p-0 text-destructive">
            <Trash2 size={13} />
          </Button>
        )}
      </div>

      {/* Condicao extra */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">CAMEX (extra)</Label>
          <Select value={ram.condicaoExtra?.camex === undefined ? 'any' : ram.condicaoExtra.camex ? 'true' : 'false'} onValueChange={v => updateCondicaoExtra('camex', v === 'any' ? undefined : v === 'true')}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">-</SelectItem>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Nao</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Lista Especial (extra)</Label>
          <Select value={ram.condicaoExtra?.listaEspecial ?? 'none'} onValueChange={v => updateCondicaoExtra('listaEspecial', v === 'none' ? undefined : v as ListaEspecial)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              <SelectItem value="industrial">Industrial (MP c/ mudanca NCM)</SelectItem>
              <SelectItem value="vedacao25a">Vedacao 25a (Pro-Emprego)</SelectItem>
              <SelectItem value="vedacao25b">Vedacao 25b (Textil/Confeccoes)</SelectItem>
              <SelectItem value="cd">CD Exclusivo (Booster)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Aplicacao (extra)</Label>
          <Select value={ram.condicaoExtra?.aplicacao ?? 'any'} onValueChange={v => updateCondicaoExtra('aplicacao', v === 'any' ? undefined : v as AplicacaoProduto)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {APLICACAO_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Override de valores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ChipEditor values={ram.override?.aliquotasAceitas ?? []} onChange={v => updateOverride('aliquotasAceitas', v as number[])} type="number" label="Aliquotas (override)" placeholder="%" />
        <CargaEfetivaSelect
          value={ram.override?.cargaEfetiva ?? 0}
          onChange={v => updateOverride('cargaEfetiva', v)}
          label="Carga Efetiva (override)"
          size="sm"
        />
        <div>
          <Label className="text-[10px] text-muted-foreground">Ref TTD (override)</Label>
          <Input value={ram.override?.refTTD ?? ''} onChange={e => updateOverride('refTTD', e.target.value || undefined as unknown as string)} placeholder="-" className="text-xs h-7" />
        </div>
      </div>
    </div>
  );
}
