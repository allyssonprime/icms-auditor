import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AppConfig } from '../types/config.ts';
import type { CnpjInfo } from '../types/validation.ts';
import type { EmpresaCadastro } from '../firebase/configService.ts';
import { simular, type SimuladorParams, type SimuladorResult, type RegimeTributario } from '../simulator/index.ts';
import { formatCurrency, formatPercent, formatNumberBR, parseNumberBR } from '../utils/formatters.ts';
import { consultarCnpj } from '../engine/cnpjService.ts';
import { buildCompanySuggestionLabel, findExactCompanyByRazao, getRazaoSuggestions, type CompanyLookupEntry } from '../simulator/companyLookup.ts';
import { Check, Plus, Trash2, Info, AlertTriangle, Building2, Package, Receipt, DollarSign, Coins, Calculator } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

/** Format raw NCM digits into 1234.56.78 pattern */
function formatNcm(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

/** Format raw CNPJ digits into XX.XXX.XXX/XXXX-XX pattern */
function formatCnpjInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const UF_LIST = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

const REGIME_OPTIONS: { value: RegimeTributario; label: string }[] = [
  { value: 'normal', label: 'Lucro Real - TTD 410' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'nao_contribuinte', label: 'Nao Contribuinte' },
];

type AplicacaoProduto = 'industrializacao' | 'uso_consumo' | 'revenda' | 'ativo_permanente';

const APLICACAO_OPTIONS: Array<{ value: AplicacaoProduto; label: string }> = [
  { value: 'industrializacao', label: 'Industrializacao' },
  { value: 'uso_consumo', label: 'Uso/consumo' },
  { value: 'revenda', label: 'Revenda' },
  { value: 'ativo_permanente', label: 'Ativo permanente' },
];

interface NcmEntry {
  ncm: string;
  aplicacao: AplicacaoProduto | undefined;
  isCamex: boolean;
  isIcmsSt: boolean;
  autoDetected: boolean;
}

function defaultNcmEntry(): NcmEntry {
  return { ncm: '', aplicacao: undefined, isCamex: false, isIcmsSt: false, autoDetected: false };
}

interface SimFormState {
  destUf: string;
  destRegime: RegimeTributario;
  destRazaoSocial: string;
  destCnpj: string;
  isPessoaFisica: boolean;
  isIndustrial: boolean;
  valorOperacao: number;
  ncmEntries: NcmEntry[];
}

function defaultFormState(): SimFormState {
  return {
    destUf: 'SC',
    destRegime: 'normal',
    destRazaoSocial: '',
    destCnpj: '',
    isPessoaFisica: false,
    isIndustrial: false,
    valorOperacao: 0,
    ncmEntries: [defaultNcmEntry()],
  };
}


interface SimuladorPageProps {
  config: AppConfig;
  regras: import('../types/regras.ts').RegrasConfig;
  empresas?: EmpresaCadastro[];
  cnpjInfoMap?: Map<string, CnpjInfo>;
  onCnpjInfoLoaded?: (info: CnpjInfo) => void;
}

export function SimuladorPage({ config, regras, empresas, cnpjInfoMap, onCnpjInfoLoaded }: SimuladorPageProps) {
  const [form, setForm] = useState<SimFormState>(defaultFormState);
  const [results, setResults] = useState<SimuladorResult[]>([]);
  const [valorDisplay, setValorDisplay] = useState('');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjResolved, setCnpjResolved] = useState(false);
  const razaoListId = 'simulador-razao-social-list';

  const companyOptions = useMemo<CompanyLookupEntry[]>(() => {
    const byCnpj = new Map<string, CompanyLookupEntry>();

    for (const empresa of empresas ?? []) {
      if (!empresa.razaoSocial?.trim()) continue;
      byCnpj.set(empresa.cnpj, {
        cnpj: empresa.cnpj,
        razaoSocial: empresa.razaoSocial.trim(),
      });
    }

    for (const info of cnpjInfoMap?.values() ?? []) {
      if (!info.razaoSocial?.trim()) continue;
      byCnpj.set(info.cnpj, {
        cnpj: info.cnpj,
        razaoSocial: info.razaoSocial.trim(),
      });
    }

    return Array.from(byCnpj.values())
      .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));
  }, [empresas, cnpjInfoMap]);

  const razaoSuggestions = useMemo(
    () => getRazaoSuggestions(companyOptions, form.destRazaoSocial, 40),
    [companyOptions, form.destRazaoSocial],
  );

  const updateForm = <K extends keyof SimFormState>(key: K, value: SimFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Auto-detect CAMEX for each NCM entry
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      ncmEntries: prev.ncmEntries.map(entry => {
        const normalized = entry.ncm.replace(/\./g, '').trim();
        if (normalized.length < 4) return entry;
        const detected = config.listaCamex.some(camexNcm => {
          const camexNorm = camexNcm.replace(/\./g, '');
          return normalized.startsWith(camexNorm);
        });
        // Only auto-update if the current value was set by auto-detection (not manual)
        if (entry.autoDetected || !entry.ncm) {
          return { ...entry, isCamex: detected, autoDetected: true };
        }
        return entry;
      }),
    }));
  }, [config.listaCamex]); // Only re-run when CAMEX list changes, not on every ncm change

  // Auto-resolve CNPJ for regime + industrial
  useEffect(() => {
    const cnpj = form.destCnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      setCnpjResolved(false);
      return;
    }
    const info = cnpjInfoMap?.get(cnpj);
    if (info) {
      setCnpjResolved(true);
      setForm(prev => ({
        ...prev,
        destRazaoSocial: info.razaoSocial || prev.destRazaoSocial,
        destRegime: info.simplesOptante === true ? 'simples_nacional' : 'normal',
        isIndustrial: info.isIndustrial,
      }));
    } else {
      setCnpjResolved(false);
    }
  }, [form.destCnpj, cnpjInfoMap]);

  const handleConsultarCnpj = useCallback(async () => {
    const cnpj = form.destCnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return;
    setCnpjLoading(true);
    try {
      const info = await consultarCnpj(cnpj);
      if (info) {
        onCnpjInfoLoaded?.(info);
        setCnpjResolved(true);
        setForm(prev => ({
          ...prev,
          destRazaoSocial: info.razaoSocial || prev.destRazaoSocial,
          destRegime: info.simplesOptante === true ? 'simples_nacional' : 'normal',
          isIndustrial: info.isIndustrial,
        }));
      }
    } finally {
      setCnpjLoading(false);
    }
  }, [form.destCnpj, onCnpjInfoLoaded]);

  const handleRazaoSocialChange = useCallback((value: string) => {
    setForm(prev => ({ ...prev, destRazaoSocial: value }));
    const matched = findExactCompanyByRazao(companyOptions, value);
    if (!matched) return;

    const cnpjInfo = cnpjInfoMap?.get(matched.cnpj);
    setCnpjResolved(Boolean(cnpjInfo));
    setForm(prev => ({
      ...prev,
      destCnpj: formatCnpjInput(matched.cnpj),
      destRegime: cnpjInfo?.simplesOptante === true ? 'simples_nacional' : prev.destRegime,
      isIndustrial: cnpjInfo?.isIndustrial ?? prev.isIndustrial,
    }));
  }, [companyOptions, cnpjInfoMap]);

  const updateNcmEntry = (idx: number, field: keyof NcmEntry, value: string | boolean | undefined) => {
    setForm(prev => {
      const entries = [...prev.ncmEntries];
      if (field === 'ncm') {
        const formatted = formatNcm(value as string);
        const normalized = formatted.replace(/\./g, '').trim();
        const detected = normalized.length >= 4 && config.listaCamex.some(camexNcm => {
          const camexNorm = camexNcm.replace(/\./g, '');
          return normalized.startsWith(camexNorm);
        });
        entries[idx] = { ...entries[idx], ncm: formatted, isCamex: detected, autoDetected: true };
      } else if (field === 'isCamex') {
        entries[idx] = { ...entries[idx], isCamex: value as boolean, autoDetected: false };
      } else if (field === 'isIcmsSt') {
        entries[idx] = { ...entries[idx], isIcmsSt: value as boolean };
      } else if (field === 'aplicacao') {
        entries[idx] = { ...entries[idx], aplicacao: value as AplicacaoProduto | undefined };
      }
      return { ...prev, ncmEntries: entries };
    });
  };

  const addNcmRow = () => {
    setForm(prev => ({ ...prev, ncmEntries: [...prev.ncmEntries, defaultNcmEntry()] }));
  };

  const removeNcmRow = (idx: number) => {
    setForm(prev => ({
      ...prev,
      ncmEntries: prev.ncmEntries.length > 1 ? prev.ncmEntries.filter((_, i) => i !== idx) : [defaultNcmEntry()],
    }));
  };

  const validEntries = form.ncmEntries.filter(e => e.ncm.replace(/\D/g, '').length >= 4);
  const canSimulate = validEntries.length > 0 && form.valorOperacao > 0;

  const handleSimular = () => {
    if (!canSimulate) return;
    const newResults = validEntries.map(entry => {
      const params: SimuladorParams = {
        destUf: form.destUf,
        destRegime: form.destRegime,
        destCnpj: form.destCnpj.replace(/\D/g, ''),
        isPessoaFisica: form.isPessoaFisica,
        ncm: entry.ncm,
        aplicacao: entry.aplicacao,
        valorOperacao: form.valorOperacao,
        temST: entry.isIcmsSt,
        isCamex: entry.isCamex,
        isIndustrial: form.isIndustrial,
      };
      return simular(params, config, regras);
    });
    setResults(newResults);
  };

  const handleLimpar = () => {
    setForm(defaultFormState());
    setResults([]);
    setValorDisplay('');
    setCnpjResolved(false);
  };

  const cnpjDigits = form.destCnpj.replace(/\D/g, '');
  const showConsultar = cnpjDigits.length === 14 && !cnpjResolved && !form.isPessoaFisica;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Simulador <span className="text-foreground/40 mx-1">&gt;</span> TTD 410
          </p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight font-heading">Simulador TTD 410</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleLimpar}
            className="text-muted-foreground hover:text-foreground"
          >
            Salvar Rascunho
          </Button>
          <Button
            onClick={handleSimular}
            disabled={!canSimulate}
            className="rounded-[10px] px-6 bg-primary text-white shadow-md"
          >
            Gerar Simulacao
          </Button>
        </div>
      </div>

      {/* Section 1: Dados do Estabelecimento */}
      <div className="bg-surface-lowest rounded-[10px] shadow-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 size={16} className="text-primary" />
          </span>
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Dados do Estabelecimento</h2>
        </div>

        <div className="flex flex-wrap items-end gap-3 md:gap-4">
          <div className="w-[220px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">CNPJ</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={form.destCnpj}
                onChange={e => updateForm('destCnpj', formatCnpjInput(e.target.value))}
                placeholder="00.000.000/0000-00"
                disabled={form.isPessoaFisica}
              />
              {showConsultar && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleConsultarCnpj}
                  disabled={cnpjLoading}
                  className="shrink-0"
                >
                  {cnpjLoading ? '...' : 'Consultar'}
                </Button>
              )}
            </div>
          </div>

          <div className="min-w-[240px] flex-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">Razao Social</Label>
            <Input
              type="text"
              value={form.destRazaoSocial}
              onChange={e => handleRazaoSocialChange(e.target.value)}
              placeholder="Digite para buscar no cadastro"
              disabled={form.isPessoaFisica}
              list={razaoListId}
            />
            <datalist id={razaoListId}>
              {razaoSuggestions.map(option => (
                <option key={option.cnpj} value={buildCompanySuggestionLabel(option)} />
              ))}
            </datalist>
          </div>

          <div className="w-[160px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">UF</Label>
            <Select value={form.destUf} onValueChange={v => updateForm('destUf', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf === 'SC' ? 'Santa Catarina' : uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[220px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">Regime</Label>
            <div className="flex items-center gap-2">
              <Select value={form.destRegime} onValueChange={v => updateForm('destRegime', v as RegimeTributario)} disabled={form.isPessoaFisica}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {cnpjResolved && <Check size={14} className="text-success-600 shrink-0" />}
            </div>
          </div>

          <div className="w-[150px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">Tipo Pessoa</Label>
            <Label className="h-10 inline-flex items-center gap-2 text-sm text-foreground cursor-pointer px-3 border border-border rounded-md bg-card">
              <Checkbox
                checked={form.isPessoaFisica}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  updateForm('isPessoaFisica', isChecked);
                  if (isChecked) {
                    updateForm('destCnpj', '');
                    updateForm('destRazaoSocial', '');
                    setCnpjResolved(false);
                  }
                }}
              />
              Pessoa Fisica
            </Label>
          </div>

          <div className="w-[140px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">Industrial</Label>
            <div className="flex items-center gap-2">
              <Select value={form.isIndustrial ? 'sim' : 'nao'} onValueChange={v => updateForm('isIndustrial', v === 'sim')} disabled={form.isPessoaFisica}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Nao</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
              {cnpjResolved && <Check size={14} className="text-success-600 shrink-0" />}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Itens para Simulacao */}
      <div className="bg-surface-lowest rounded-[10px] shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Package size={16} className="text-primary" />
            </span>
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Itens para Simulacao</h2>
          </div>
          {validEntries.length > 0 && (
            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
              {validEntries.length} {validEntries.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </Badge>
          )}
        </div>

        {/* Valor da Operacao - above table */}
        <div className="mb-4 max-w-[240px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">Valor da Operacao (R$)</Label>
          <Input
            type="text"
            value={valorDisplay}
            onChange={e => setValorDisplay(e.target.value)}
            onBlur={() => {
              const parsed = parseNumberBR(valorDisplay);
              updateForm('valorOperacao', parsed);
              if (parsed > 0) setValorDisplay(formatNumberBR(parsed));
            }}
            onFocus={e => e.target.select()}
            placeholder="1.000,00"
          />
        </div>

        {/* NCM Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-surface-low">
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">NCM</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Aplicacao</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-center">CAMEX</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-center">ICMS ST</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-right">Subtotal</TableHead>
                <TableHead className="w-[44px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.ncmEntries.map((entry, idx) => (
                <TableRow key={idx} className="hover:bg-surface-low/50">
                  <TableCell className="px-4 py-2">
                    <Input
                      type="text"
                      value={entry.ncm}
                      onChange={e => updateNcmEntry(idx, 'ncm', e.target.value)}
                      placeholder="8471.30.19"
                      className="font-mono h-9 border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 focus-visible:bg-surface-low rounded"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Select
                      value={entry.aplicacao ?? '_none'}
                      onValueChange={v => updateNcmEntry(idx, 'aplicacao', v === '_none' ? undefined : v as AplicacaoProduto)}
                    >
                      <SelectTrigger className="text-xs h-9 border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nao informado</SelectItem>
                        {APLICACAO_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center">
                    <Select value={entry.isCamex ? 'sim' : 'nao'} onValueChange={v => updateNcmEntry(idx, 'isCamex', v === 'sim')}>
                      <SelectTrigger className="text-xs h-9 border-0 bg-transparent shadow-none mx-auto w-[80px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao">Nao</SelectItem>
                        <SelectItem value="sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-center">
                    <Select value={entry.isIcmsSt ? 'sim' : 'nao'} onValueChange={v => updateNcmEntry(idx, 'isIcmsSt', v === 'sim')}>
                      <SelectTrigger className="text-xs h-9 border-0 bg-transparent shadow-none mx-auto w-[80px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao">Nao</SelectItem>
                        <SelectItem value="sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right font-mono text-muted-foreground tabular-nums">
                    {form.valorOperacao > 0 && entry.ncm.replace(/\D/g, '').length >= 4
                      ? formatCurrency(form.valorOperacao)
                      : '\u2014'}
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeNcmRow(idx)}
                      className="h-8 w-8 text-muted-foreground hover:text-danger-600 hover:bg-danger-50"
                      title="Remover item"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={addNcmRow}
          className="text-primary mt-3 uppercase text-[11px] font-semibold tracking-wider"
        >
          <Plus size={14} />
          Adicionar Item
        </Button>
      </div>

      {/* Resultados */}
      {results.length > 0 && <ResultsView results={results} />}
    </div>
  );
}

// ── Resultados ──────────────────────────────────────────────────

function ResultsView({ results }: { results: SimuladorResult[] }) {
  const totals = results.reduce(
    (acc, r) => ({
      bcIntegral: acc.bcIntegral + r.bcIntegral,
      icmsDestacado: acc.icmsDestacado + r.icmsDestacado,
      icmsRecolher: acc.icmsRecolher + r.icmsRecolhimento.valor,
      fundos: acc.fundos + r.fundosSociais.valor,
      total: acc.total + r.totalRecolher.valor,
    }),
    { bcIntegral: 0, icmsDestacado: 0, icmsRecolher: 0, fundos: 0, total: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Vedado warnings - PROMINENT */}
      {results.some(r => r.isVedado) && (
        <div className="rounded-[10px] bg-destructive/10 border-2 border-destructive/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
              <AlertTriangle size={16} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-destructive uppercase tracking-wide">
              VEDACAO — TTD 410 NAO pode ser aplicado
            </h3>
          </div>
          {results.filter(r => r.isVedado).map((r, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-t border-destructive/20">
              <Badge variant="destructive" className="font-mono font-bold text-xs px-2 py-0.5 shrink-0">{r.ncm}</Badge>
              <span className="text-sm font-medium text-destructive">{r.vedacaoMsg}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total BC ICMS */}
        <div className="bg-surface-lowest rounded-[10px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Receipt size={14} className="text-primary" />
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total BC ICMS</span>
          </div>
          <p className="text-xl font-bold text-foreground font-heading tabular-nums">{formatCurrency(totals.bcIntegral)}</p>
        </div>

        {/* ICMS Destacado */}
        <div className="bg-surface-lowest rounded-[10px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign size={14} className="text-primary" />
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ICMS Destacado</span>
          </div>
          <p className="text-xl font-bold text-foreground font-heading tabular-nums">{formatCurrency(totals.icmsDestacado)}</p>
        </div>

        {/* ICMS A Recolher - highlighted card */}
        <div className="bg-primary rounded-[10px] p-6 shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <Calculator size={14} className="text-white" />
            </span>
            <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">ICMS a Recolher</span>
          </div>
          <p className="text-2xl font-bold text-white font-heading tabular-nums">{formatCurrency(totals.icmsRecolher)}</p>
        </div>

        {/* Fundos 0,4% */}
        <div className="bg-surface-lowest rounded-[10px] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins size={14} className="text-primary" />
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fundos 0,4%</span>
          </div>
          <p className="text-xl font-bold text-foreground font-heading tabular-nums">{formatCurrency(totals.fundos)}</p>
        </div>
      </div>

      {/* Memoria de Calculo Detalhada */}
      <div className="bg-surface-lowest rounded-[10px] shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Calculator size={16} className="text-primary" />
          </span>
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Memoria de Calculo Detalhada</h2>
          {results.length > 1 && (
            <Badge variant="secondary" className="ml-auto font-mono text-[10px]">{results.length} NCMs</Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[800px] text-xs">
            <TableHeader>
              <TableRow className="bg-surface-low">
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">NCM / Cenario</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-center">Aliq. Dest.</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-right">Base de Calculo</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-right">ICMS Destacado</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-center">CP %</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-right">ICMS a Recolher</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-right">Fundos</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 text-right">Total a Pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, idx) => (
                <DetailRow key={idx} result={r} />
              ))}
            </TableBody>
            {results.length > 1 && (
              <TableFooter>
                <TableRow className="bg-surface-low border-t-2 border-border font-semibold">
                  <TableCell className="px-4 py-3 text-foreground text-xs font-bold">Totais Consolidados</TableCell>
                  <TableCell className="px-4 py-3"></TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-foreground tabular-nums">{formatCurrency(totals.bcIntegral)}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-foreground tabular-nums">{formatCurrency(totals.icmsDestacado)}</TableCell>
                  <TableCell className="px-4 py-3"></TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-primary font-bold tabular-nums">{formatCurrency(totals.icmsRecolher)}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums">{formatCurrency(totals.fundos)}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-foreground font-bold tabular-nums">{formatCurrency(totals.total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>

      {/* Observacoes - Warning Banner */}
      {results.some(r => r.observacoes.length > 0) && (
        <div className="flex items-start gap-3 rounded-[10px] bg-warning/10 border border-warning/30 px-5 py-4">
          <AlertTriangle size={18} className="text-warning-600 shrink-0 mt-0.5" />
          <div>
            <ul className="text-xs text-foreground space-y-1">
              {[...new Set(results.flatMap(r => r.observacoes))].map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ result: r }: { result: SimuladorResult }) {
  const vedadoRow = r.isVedado;

  const rowClass = vedadoRow
    ? 'bg-danger-50 text-danger-700'
    : 'hover:bg-surface-low/50 transition-colors';

  return (
    <TableRow className={rowClass}>
      {/* NCM / Cenario */}
      <TableCell className="px-4 py-3 text-foreground">
        <div className="flex items-center gap-1.5">
          {vedadoRow && <AlertTriangle size={14} className="text-danger-600 shrink-0" />}
          <div>
            <span className="font-mono font-semibold text-xs">{r.ncm}</span>
            {!vedadoRow && (
              <div className="flex items-center gap-1 mt-0.5">
                <Badge className="font-mono text-[9px] px-1 py-0">{r.cenarioClassificado}</Badge>
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{r.cenarioNome}</span>
                {r.refTTD && <span className="text-[10px] text-muted-foreground font-mono">[{r.refTTD}]</span>}
              </div>
            )}
            {vedadoRow && <span className="text-[10px] text-danger-600 font-bold ml-1">VEDADO</span>}
          </div>
        </div>
      </TableCell>
      {/* Aliq. Destacada */}
      <TableCell className={cn('px-4 py-3 text-center font-mono font-bold tabular-nums', vedadoRow ? 'text-danger-600 line-through' : 'text-primary')}>
        {formatPercent(r.aliquotaDestacada)}
      </TableCell>
      {/* Base de Calculo */}
      <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums">
        {formatCurrency(r.bcIntegral)}
      </TableCell>
      {/* ICMS Destacado */}
      <TableCell className={cn('px-4 py-3 text-right font-mono tabular-nums', vedadoRow ? 'text-danger-600 line-through' : 'text-foreground font-semibold')}>
        {formatCurrency(r.icmsDestacado)}
      </TableCell>
      {/* CP % */}
      <TableCell className="px-4 py-3 text-center text-muted-foreground tabular-nums">
        {r.creditoPresumido > 0 ? formatPercent(r.creditoPresumido) : '\u2014'}
      </TableCell>
      {/* ICMS a Recolher */}
      <TableCell className="px-4 py-3 text-right font-mono tabular-nums">
        <span className="text-primary font-semibold">{formatCurrency(r.icmsRecolhimento.valor)}</span>
        <span className="text-muted-foreground text-[10px] ml-1">({formatPercent(r.icmsRecolhimento.pct)})</span>
      </TableCell>
      {/* Fundos */}
      <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums">
        {formatCurrency(r.fundosSociais.valor)}
        <span className="text-[10px] ml-1">({formatPercent(r.fundosSociais.pct)})</span>
      </TableCell>
      {/* Total a Pagar */}
      <TableCell className="px-4 py-3 text-right font-mono font-bold text-foreground tabular-nums">
        {formatCurrency(r.totalRecolher.valor)}
      </TableCell>
    </TableRow>
  );
}
