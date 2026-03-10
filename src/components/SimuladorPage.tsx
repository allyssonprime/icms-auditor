import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AppConfig } from '../types/config.ts';
import type { CnpjInfo } from '../types/validation.ts';
import type { EmpresaCadastro } from '../firebase/configService.ts';
import { simular, type SimuladorParams, type SimuladorResult, type RegimeTributario } from '../simulator/index.ts';
import { formatCurrency, formatPercent, formatNumberBR, parseNumberBR } from '../utils/formatters.ts';
import { consultarCnpj } from '../engine/cnpjService.ts';
import { buildCompanySuggestionLabel, findExactCompanyByRazao, getRazaoSuggestions, type CompanyLookupEntry } from '../simulator/companyLookup.ts';
import { Check, Plus, Trash2, Info, AlertTriangle } from 'lucide-react';

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
  { value: 'normal', label: 'Contribuinte Normal' },
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
  aplicacao: AplicacaoProduto;
  isCamex: boolean;
  isIcmsSt: boolean;
  autoDetected: boolean;
}

function defaultNcmEntry(): NcmEntry {
  return { ncm: '', aplicacao: 'revenda', isCamex: false, isIcmsSt: false, autoDetected: false };
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
  empresas?: EmpresaCadastro[];
  cnpjInfoMap?: Map<string, CnpjInfo>;
  onCnpjInfoLoaded?: (info: CnpjInfo) => void;
}

export function SimuladorPage({ config, empresas, cnpjInfoMap, onCnpjInfoLoaded }: SimuladorPageProps) {
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

  const updateNcmEntry = (idx: number, field: keyof NcmEntry, value: string | boolean) => {
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
        entries[idx] = { ...entries[idx], aplicacao: value as AplicacaoProduto };
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
      return simular(params, config);
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
    <div className="space-y-5">
      {/* Formulario */}
      <Card className="shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#2B318A] to-[#5A81FA] px-6 py-5">
          <h2 className="text-lg font-bold text-white">Simulador TTD 410</h2>
          <p className="text-sm text-white/60 mt-0.5">Simule cenarios tributarios para operacoes com TTD 410/SC</p>
        </div>
        <CardContent className="pt-6">
          {/* Destinatario */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-[10px] font-bold text-white shadow-sm">1</span>
              Destinatario
            </h3>
            <div className="flex flex-wrap items-end gap-3 md:gap-4">
              <div className="w-[96px]">
                <Label className="text-xs uppercase tracking-wide">UF Destino</Label>
                <Select value={form.destUf} onValueChange={v => updateForm('destUf', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[220px]">
                <Label className="text-xs uppercase tracking-wide">Regime Tributario</Label>
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
              <div className="min-w-[260px] flex-1">
                <Label className="text-xs uppercase tracking-wide">Razao Social</Label>
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
              <div className="w-[260px]">
                <Label className="text-xs uppercase tracking-wide">CNPJ Destinatario</Label>
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
                      {cnpjLoading ? 'Consultando...' : 'Consultar'}
                    </Button>
                  )}
                </div>
              </div>
              <div className="w-[170px]">
                <Label className="text-xs uppercase tracking-wide">Tipo Pessoa</Label>
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
              <div className="w-[170px]">
                <Label className="text-xs uppercase tracking-wide">Industrial</Label>
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

          {/* Produto — NCM por linha */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-[10px] font-bold text-white shadow-sm">2</span>
              Produto
            </h3>

            <div className="space-y-2">
              {/* NCM table header */}
              <div className="grid grid-cols-[1fr_180px_120px_120px_36px] gap-2 items-center px-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">NCM</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Aplicacao</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">CAMEX</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">ICMS ST</span>
                <span></span>
              </div>

              {form.ncmEntries.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_180px_120px_120px_36px] gap-2 items-center">
                  <Input
                    type="text"
                    value={entry.ncm}
                    onChange={e => updateNcmEntry(idx, 'ncm', e.target.value)}
                    placeholder="8471.30.19"
                    className="font-mono"
                  />
                  <Select value={entry.aplicacao} onValueChange={v => updateNcmEntry(idx, 'aplicacao', v as AplicacaoProduto)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APLICACAO_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={entry.isCamex ? 'sim' : 'nao'} onValueChange={v => updateNcmEntry(idx, 'isCamex', v === 'sim')}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Nao</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={entry.isIcmsSt ? 'sim' : 'nao'} onValueChange={v => updateNcmEntry(idx, 'isIcmsSt', v === 'sim')}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Nao</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeNcmRow(idx)}
                    className="h-8 w-8 text-muted-foreground hover:text-danger-600 hover:bg-danger-50"
                    title="Remover NCM"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                onClick={addNcmRow}
                className="text-primary mt-1"
              >
                <Plus size={14} />
                Adicionar NCM
              </Button>
            </div>
          </div>

          {/* Operacao */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-[10px] font-bold text-white shadow-sm">3</span>
              Operacao
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wide">Valor da Operacao (R$)</Label>
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
            </div>
          </div>

          {/* Botoes */}
          <div className="flex gap-3 pt-4 mt-2 border-t border-border">
            <Button
              onClick={handleSimular}
              disabled={!canSimulate}
            >
              Simular
            </Button>
            <Button
              variant="outline"
              onClick={handleLimpar}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

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
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">
          Resultado da Simulacao{results.length > 1 ? ` (${results.length} NCMs)` : ''}
        </CardTitle>
      </CardHeader>

      {/* Vedado warnings at top */}
      {results.some(r => r.isVedado) && (
        <div className="mx-6 mb-2">
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Item(ns) vedado(s) — TTD 410 NAO pode ser aplicado</AlertTitle>
            <AlertDescription>
              {results.filter(r => r.isVedado).map((r, i) => (
                <p key={i} className="text-xs mt-1">
                  <span className="font-mono font-semibold">{r.ncm}</span> — {r.vedacaoMsg}
                </p>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px] text-xs">
            <TableHeader>
              <TableRow className="bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <TableHead className="text-left px-4 py-2.5 font-medium">NCM</TableHead>
                <TableHead className="text-left px-4 py-2.5 font-medium">Cenario</TableHead>
                <TableHead className="text-left px-4 py-2.5 font-medium">Ref TTD</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium bg-primary/5">Aliq. Dest.</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium">BC Integral</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium bg-primary/5">ICMS Destacado</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium">CP %</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium">ICMS Recolher</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium">Fundos 0,4%</TableHead>
                <TableHead className="text-right px-4 py-2.5 font-medium">Total Recolher</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, idx) => (
                <ResultRow key={idx} result={r} />
              ))}
            </TableBody>
            {results.length > 1 && (
              <TableFooter>
                <TableRow className="bg-muted border-t-2 border-border font-semibold">
                  <TableCell className="px-4 py-3 text-foreground" colSpan={3}>Total</TableCell>
                  <TableCell className="px-4 py-3 bg-primary/5"></TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(totals.bcIntegral)}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-primary bg-primary/5 text-sm">{formatCurrency(totals.icmsDestacado)}</TableCell>
                  <TableCell className="px-4 py-3"></TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(totals.icmsRecolher)}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(totals.fundos)}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-foreground">{formatCurrency(totals.total)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        {/* Observacoes consolidadas */}
        {results.some(r => r.observacoes.length > 0) && (
          <div className="bg-amber-50/50 border-t border-border px-6 py-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
              <Info size={14} />
              Observacoes
            </h4>
            <ul className="list-disc list-inside text-xs text-foreground space-y-1">
              {/* Deduplicate observations across results */}
              {[...new Set(results.flatMap(r => r.observacoes))].map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultRow({ result: r }: { result: SimuladorResult }) {
  const vedadoRow = r.isVedado;
  const rowClass = vedadoRow
    ? 'border-t border-danger-100 bg-danger-50/60'
    : 'border-t border-border hover:bg-muted transition-colors';

  return (
    <TableRow className={rowClass}>
      <TableCell className="px-4 py-3 font-mono text-foreground">
        <span className="flex items-center gap-1.5">
          {vedadoRow && <AlertTriangle size={14} className="text-danger-600 shrink-0" />}
          {r.ncm}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          {vedadoRow ? (
            <Badge variant="destructive" className="font-mono font-bold text-[10px] px-1.5 py-0.5">VEDADO</Badge>
          ) : (
            <Badge className="font-mono font-bold text-[10px] px-1.5 py-0.5">{r.cenarioClassificado}</Badge>
          )}
          <span className={cn('truncate max-w-[120px]', vedadoRow ? 'text-danger-600' : 'text-muted-foreground')} title={r.cenarioNome}>{r.cenarioNome}</span>
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{r.refTTD || '\u2014'}</TableCell>
      <TableCell className={cn('px-4 py-3 text-right font-mono font-bold text-sm', vedadoRow ? 'bg-danger-50 text-danger-700 line-through' : 'bg-primary/5 text-primary')}>
        {formatPercent(r.aliquotaDestacada)}
      </TableCell>
      <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(r.bcIntegral)}</TableCell>
      <TableCell className={cn('px-4 py-3 text-right font-mono font-bold text-sm', vedadoRow ? 'bg-danger-50 text-danger-700 line-through' : 'bg-primary/5 text-primary')}>
        {formatCurrency(r.icmsDestacado)}
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-muted-foreground">{r.creditoPresumido > 0 ? formatPercent(r.creditoPresumido) : '\u2014'}</TableCell>
      <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground">
        {formatCurrency(r.icmsRecolhimento.valor)}
        <span className="text-muted-foreground ml-1">({formatPercent(r.icmsRecolhimento.pct)})</span>
      </TableCell>
      <TableCell className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(r.fundosSociais.valor)}</TableCell>
      <TableCell className="px-4 py-3 text-right font-mono font-semibold text-foreground">{formatCurrency(r.totalRecolher.valor)}</TableCell>
    </TableRow>
  );
}
