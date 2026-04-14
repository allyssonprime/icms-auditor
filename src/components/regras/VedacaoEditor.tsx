import { useState } from 'react';
import type { VedacaoRule, CondicaoVedacao, TipoOperacao, CfopMatch, TipoDest, ListaEspecial } from '../../types/regras.ts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChipEditor } from './ChipEditor.tsx';
import { ChevronDown, ChevronRight, Plus, Trash2, Info } from 'lucide-react';

interface VedacaoEditorProps {
  vedacoes: VedacaoRule[];
  onSave: (vedacoes: VedacaoRule[]) => void;
}

const DESCRICOES: Record<string, string> = {
  V01: 'Bloqueia NCMs listadas no Decreto 2.128 — produto nao pode utilizar o TTD. Excecao: operacao interna SC com aliquota >= 12% e sem credito presumido gera apenas alerta.',
  V02: 'Bloqueia operacoes com mercadoria usada (CFOPs 5922 e 6922) — TTD nao se aplica.',
};

function emptyVedacao(): VedacaoRule {
  return {
    id: `V${Date.now()}`,
    nome: '',
    tipo: 'ncm_prefix',
    fonte: 'inline',
    valores: [],
    mensagemErro: '',
    regra: '',
    ativo: true,
  };
}

const TIPO_DEST_OPTIONS: { value: TipoDest; label: string }[] = [
  { value: 'contribuinte', label: 'Contribuinte' },
  { value: 'sn', label: 'Simples Nacional' },
  { value: 'pj_nc', label: 'PJ Nao Contribuinte' },
  { value: 'pf', label: 'Pessoa Fisica' },
];

function CondicaoVedacaoEditor({ condicao, onChange }: { condicao: CondicaoVedacao; onChange: (c: CondicaoVedacao) => void }) {
  return (
    <div className="space-y-2 p-3 rounded border bg-muted/30">
      <p className="text-[10px] text-muted-foreground font-medium">Condicoes da operacao que ativam esta vedacao</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-[10px]">Operacao</Label>
          <Select value={condicao.operacao ?? 'any'} onValueChange={v => onChange({ ...condicao, operacao: v === 'any' ? undefined : v as TipoOperacao })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="interestadual">Interestadual</SelectItem>
              <SelectItem value="interna">Interna</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">CFOP Match</Label>
          <Select value={condicao.cfopMatch ?? 'any'} onValueChange={v => onChange({ ...condicao, cfopMatch: v === 'any' ? undefined : v as CfopMatch })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="devolucao">Devolucao</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Lista Especial</Label>
          <Select value={condicao.listaEspecial ?? 'any'} onValueChange={v => onChange({ ...condicao, listaEspecial: v === 'any' ? undefined : v as ListaEspecial })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="vedacao25a">Vedacao 25a (Pro-Emprego)</SelectItem>
              <SelectItem value="vedacao25b">Vedacao 25b (Textil)</SelectItem>
              <SelectItem value="cd">CD Exclusivo (Booster)</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-[10px] mb-1 block">Tipo Destinatario (OR)</Label>
        <div className="flex flex-wrap gap-3">
          {TIPO_DEST_OPTIONS.map(opt => (
            <div key={opt.value} className="flex items-center gap-1">
              <Checkbox
                checked={(condicao.tipoDest ?? []).includes(opt.value)}
                onCheckedChange={checked => {
                  const current = condicao.tipoDest ?? [];
                  const next = checked ? [...current, opt.value] : current.filter(v => v !== opt.value);
                  onChange({ ...condicao, tipoDest: next.length > 0 ? next : undefined });
                }}
                id={`vcond-${opt.value}`}
              />
              <Label htmlFor={`vcond-${opt.value}`} className="text-[10px] cursor-pointer">{opt.label}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VedacaoEditor({ vedacoes: initial, onSave }: VedacaoEditorProps) {
  const [vedacoes, setVedacoes] = useState<VedacaoRule[]>(structuredClone(initial));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function updateVedacao(index: number, rule: VedacaoRule) {
    const next = [...vedacoes];
    next[index] = rule;
    setVedacoes(next);
    setDirty(true);
  }

  function addVedacao() {
    const novo = emptyVedacao();
    setVedacoes([...vedacoes, novo]);
    setExpanded(novo.id);
    setDirty(true);
  }

  function removeVedacao(index: number) {
    setVedacoes(vedacoes.filter((_, i) => i !== index));
    setDirty(true);
  }

  return (
    <div className="space-y-3">
      {vedacoes.map((rule, index) => {
        const isConfig = rule.fonte === 'config';
        const descricao = DESCRICOES[rule.regra];

        return (
          <Card key={rule.id || index} className="overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setExpanded(expanded === rule.id ? null : rule.id)}
            >
              <div className="flex items-center gap-2">
                {expanded === rule.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Badge variant="default" className="text-[10px] font-mono">{rule.regra || '?'}</Badge>
                <span className="text-xs font-semibold">{rule.nome || 'Sem nome'}</span>
                <Badge variant={rule.tipo === 'condicao_operacao' ? 'default' : rule.tipo === 'ncm_prefix' ? 'secondary' : 'outline'} className="text-[10px]">
                  {rule.tipo === 'ncm_prefix' ? 'NCM' : rule.tipo === 'cfop_exato' ? 'CFOP' : 'Operacao'}
                </Badge>
                {isConfig && (
                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
                    Lista do Cadastro
                  </Badge>
                )}
              </div>
              <Badge variant={rule.ativo ? 'default' : 'outline'} className="text-[10px]">
                {rule.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </button>

            {expanded === rule.id && (
              <CardContent className="border-t pt-3 space-y-3">
                {/* Descricao da regra */}
                {descricao && (
                  <div className="flex gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-700 dark:text-blue-300">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <span>{descricao}</span>
                  </div>
                )}

                {/* Campos basicos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Codigo da Regra</Label>
                    <Input value={rule.regra} onChange={e => updateVedacao(index, { ...rule, regra: e.target.value })} placeholder="Ex: V01" className="text-xs h-8" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Nome</Label>
                    <Input value={rule.nome} onChange={e => updateVedacao(index, { ...rule, nome: e.target.value })} className="text-xs h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo de verificacao</Label>
                    <Select value={rule.tipo} onValueChange={v => updateVedacao(index, { ...rule, tipo: v as VedacaoRule['tipo'] })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ncm_prefix">Prefixo de NCM</SelectItem>
                        <SelectItem value="cfop_exato">CFOP exato</SelectItem>
                        <SelectItem value="condicao_operacao">Condicao de operacao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox checked={rule.ativo} onCheckedChange={v => updateVedacao(index, { ...rule, ativo: !!v })} id={`ved-ativo-${index}`} />
                    <Label htmlFor={`ved-ativo-${index}`} className="text-xs cursor-pointer">Regra ativa</Label>
                  </div>
                </div>

                {/* Valores — depende do tipo */}
                {rule.tipo === 'condicao_operacao' ? (
                  <CondicaoVedacaoEditor
                    condicao={rule.condicaoVedacao ?? {}}
                    onChange={c => updateVedacao(index, { ...rule, condicaoVedacao: c })}
                  />
                ) : isConfig ? (
                  <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                    Esta vedacao usa a lista <strong>{rule.campoConfig === 'decreto2128' ? 'Decreto 2.128' : rule.campoConfig}</strong> gerenciada na aba Cadastros &gt; NCMs.
                  </div>
                ) : (
                  <ChipEditor
                    values={rule.valores ?? []}
                    onChange={v => updateVedacao(index, { ...rule, valores: v as string[] })}
                    label={rule.tipo === 'ncm_prefix' ? 'Prefixos NCM vedados' : 'CFOPs vedados'}
                    placeholder={rule.tipo === 'ncm_prefix' ? 'Ex: 7005' : 'Ex: 5922'}
                  />
                )}

                {/* Excecao */}
                {rule.excecao && (
                  <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-amber-700 dark:text-amber-400">Excecao (gera AVISO ao inves de ERRO)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-[10px] text-muted-foreground">{rule.excecao.descricao}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" onClick={() => removeVedacao(index)} className="text-xs gap-1">
                    <Trash2 size={12} /> Remover
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="flex gap-2 justify-between">
        <Button variant="outline" size="sm" onClick={addVedacao} className="text-xs gap-1">
          <Plus size={12} /> Nova Vedacao
        </Button>
        {dirty && (
          <Button size="sm" onClick={() => { onSave(vedacoes); setDirty(false); }} className="text-xs">
            Salvar Vedacoes
          </Button>
        )}
      </div>
    </div>
  );
}
