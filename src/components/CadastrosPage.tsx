import { useState, useEffect, useCallback } from 'react';
import {
  getNcmLists, salvarNcmLists,
  getCnpjOverrides, salvarCnpjOverrides,
  getAllEmpresas, setIndustrialOverride,
  type EmpresaCadastro, type NcmListsFirestore, type CnpjOverridesFirestore,
} from '../firebase/configService.ts';
import { reconsultarCnpj } from '../engine/cnpjService.ts';
import { formatCNPJ } from '../utils/formatters.ts';
import { Building2, List, Shield, RefreshCw, Search, X, Plus, ChevronUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface CadastrosPageProps {
  onConfigChanged: () => void;
}

// === Helpers ===
function listToText(list: string[]): string { return list.join('\n'); }
function textToList(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
}
function textToNcmList(text: string): string[] {
  return text.split('\n').map(s => s.replace(/\D/g, '')).filter(s => s.length >= 4);
}
function textToNcmListShort(text: string): string[] {
  return text.split('\n').map(s => s.replace(/\D/g, '')).filter(s => s.length >= 2);
}
function formatNcmCode(ncm: string): string {
  const d = ncm.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
  if (d.length === 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return d;
}
type Tab = 'empresas' | 'ncm' | 'cnpjOverrides';

export function CadastrosPage({ onConfigChanged }: CadastrosPageProps) {
  const [tab, setTab] = useState<Tab>('empresas');
  const [empresas, setEmpresas] = useState<EmpresaCadastro[]>([]);
  const [ncmLists, setNcmLists] = useState<NcmListsFirestore | null>(null);
  const [cnpjOverrides, setCnpjOverrides] = useState<CnpjOverridesFirestore | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const reloadEmpresas = useCallback(async () => {
    const emp = await getAllEmpresas();
    setEmpresas(emp);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [emp, ncm, overrides] = await Promise.all([
        getAllEmpresas(),
        getNcmLists(),
        getCnpjOverrides(),
      ]);
      setEmpresas(emp);
      setNcmLists(ncm);
      setCnpjOverrides(overrides);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando cadastros do Firebase...</div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <Card className="shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#2B318A] to-[#5A81FA] px-6 py-5">
          <h2 className="text-lg font-bold text-white">Cadastros</h2>
          <p className="text-sm text-white/60 mt-0.5">Gerencie empresas, listas NCM e vedacoes</p>
        </div>
        <CardContent className="pt-5">
          <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
            <TabsList className="mb-5">
              <TabsTrigger value="empresas" className="gap-1.5">
                <Building2 size={14} />
                Empresas ({empresas.length})
              </TabsTrigger>
              <TabsTrigger value="ncm" className="gap-1.5">
                <List size={14} />
                Listas NCM
              </TabsTrigger>
              <TabsTrigger value="cnpjOverrides" className="gap-1.5">
                <Shield size={14} />
                Vedacoes / CD
              </TabsTrigger>
            </TabsList>

            <TabsContent value="empresas">
              <EmpresasTab
                empresas={empresas}
                setEmpresas={setEmpresas}
                search={search}
                setSearch={setSearch}
                onConfigChanged={onConfigChanged}
                reloadEmpresas={reloadEmpresas}
              />
            </TabsContent>
            <TabsContent value="ncm">
              <NcmTab ncmLists={ncmLists} setNcmLists={setNcmLists} onConfigChanged={onConfigChanged} />
            </TabsContent>
            <TabsContent value="cnpjOverrides">
              <CnpjOverridesTab overrides={cnpjOverrides} setOverrides={setCnpjOverrides} onConfigChanged={onConfigChanged} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// === Empresas Tab ===

function EmpresasTab({
  empresas, setEmpresas, search, setSearch, onConfigChanged, reloadEmpresas,
}: {
  empresas: EmpresaCadastro[];
  setEmpresas: (e: EmpresaCadastro[]) => void;
  search: string;
  setSearch: (s: string) => void;
  onConfigChanged: () => void;
  reloadEmpresas: () => Promise<void>;
}) {
  const [isReconsulting, setIsReconsulting] = useState(false);
  const [reconsultProgress, setReconsultProgress] = useState({ done: 0, total: 0 });

  const q = search.toLowerCase().replace(/[.\-/]/g, '');
  const filtered = q
    ? empresas.filter(e =>
      e.cnpj.includes(q) ||
      e.razaoSocial.toLowerCase().includes(q) ||
      e.cnaePrincipal.includes(q) ||
      (e.uf ?? '').toLowerCase().includes(q)
    )
    : empresas;

  const handleToggleIndustrial = useCallback(async (cnpj: string, current: EmpresaCadastro) => {
    let newOverride: boolean | undefined;
    if (current.industrialOverride === undefined) {
      newOverride = !current.isIndustrial;
    } else {
      newOverride = undefined;
    }

    await setIndustrialOverride(cnpj, newOverride);
    setEmpresas(empresas.map(e =>
      e.cnpj === cnpj ? { ...e, industrialOverride: newOverride } : e
    ));
    onConfigChanged();
  }, [empresas, setEmpresas, onConfigChanged]);

  const handleReconsultAll = useCallback(async () => {
    if (empresas.length === 0) return;
    setIsReconsulting(true);
    setReconsultProgress({ done: 0, total: empresas.length });

    for (let i = 0; i < empresas.length; i++) {
      await reconsultarCnpj(empresas[i]!.cnpj);
      setReconsultProgress({ done: i + 1, total: empresas.length });
    }

    await reloadEmpresas();
    setIsReconsulting(false);
    onConfigChanged();
  }, [empresas, reloadEmpresas, onConfigChanged]);

  const sn = empresas.filter(e => e.simplesOptante === true).length;
  const ind = empresas.filter(e => getEffectiveIndustrial(e)).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar CNPJ, razao social, CNAE, UF..."
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleReconsultAll}
          disabled={isReconsulting || empresas.length === 0}
          className="shrink-0"
        >
          <RefreshCw size={12} className={isReconsulting ? 'animate-spin' : ''} />
          {isReconsulting
            ? `Consultando... (${reconsultProgress.done}/${reconsultProgress.total})`
            : `Reconsultar todos (${empresas.length})`}
        </Button>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} empresas | {sn} SN | {ind} industrial (10%)
        </span>
      </div>

      <div className="border border-border rounded-lg overflow-auto max-h-[500px]">
        <Table className="text-xs">
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              <TableHead className="text-xs font-medium uppercase tracking-wider">CNPJ</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider">Razao Social</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider">UF</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-center">SN</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-center">MEI</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider">CNAE</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-center">Ind 10%</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider">Consultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const effectiveInd = getEffectiveIndustrial(e);
              const isOverridden = e.industrialOverride !== undefined;
              return (
                <TableRow key={e.cnpj}>
                  <TableCell className="font-mono">{formatCNPJ(e.cnpj)}</TableCell>
                  <TableCell>
                    <div className="truncate max-w-[260px]" title={e.razaoSocial}>{e.razaoSocial}</div>
                  </TableCell>
                  <TableCell>{e.uf ?? '-'}</TableCell>
                  <TableCell className="text-center">
                    {e.simplesOptante === true && <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">Sim</Badge>}
                    {e.simplesOptante === false && <span className="text-muted-foreground">Nao</span>}
                    {e.simplesOptante === null && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {e.isMei === true && <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Sim</Badge>}
                    {e.isMei === false && <span className="text-muted-foreground">Nao</span>}
                    {e.isMei === null && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{e.cnaePrincipal}</span>
                    <span className="ml-1 text-muted-foreground truncate max-w-[120px] inline-block align-bottom" title={e.cnaeDescricao}>
                      {e.cnaeDescricao}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleIndustrial(e.cnpj, e)}
                      className={cn(
                        'h-auto px-1.5 py-0.5 text-[10px] font-medium',
                        effectiveInd
                          ? isOverridden ? 'bg-blue-200 text-blue-800 border-blue-300' : 'bg-blue-100 text-blue-700 border-blue-200'
                          : isOverridden ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                      )}
                      title={
                        isOverridden
                          ? `Manual (${effectiveInd ? 'incluido' : 'excluido'}). Clique para voltar ao automatico.`
                          : `Automatico (CNAE ${e.isIndustrial ? 'industrial' : 'nao-industrial'}). Clique para alterar.`
                      }
                    >
                      {effectiveInd ? 'Sim' : 'Nao'}
                      {isOverridden && ' *'}
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.consultadoEm
                      ? e.consultadoEm.toLocaleDateString('pt-BR')
                      : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-[10px] text-muted-foreground mt-3">
        * = override manual. Clique na coluna "Ind 10%" para incluir/excluir da lista de 10%. Dados reconsultados automaticamente no inicio de cada mes.
      </p>
    </div>
  );
}

function getEffectiveIndustrial(e: EmpresaCadastro): boolean {
  if (e.industrialOverride !== undefined) return e.industrialOverride;
  return e.isIndustrial;
}

// === NCM Tab ===

function NcmTab({
  ncmLists, setNcmLists, onConfigChanged,
}: {
  ncmLists: NcmListsFirestore | null;
  setNcmLists: (n: NcmListsFirestore) => void;
  onConfigChanged: () => void;
}) {
  const [decreto, setDecreto] = useState<string[]>(ncmLists?.decreto2128 ?? []);
  const [camex, setCamex] = useState<string[]>(ncmLists?.camex ?? []);
  const [cobreAco, setCobreAco] = useState<string[]>(ncmLists?.cobreAco ?? []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data: NcmListsFirestore = {
      decreto2128: decreto,
      camex: camex,
      cobreAco: cobreAco,
    };
    await salvarNcmLists(data);
    setNcmLists(data);
    onConfigChanged();
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <NcmListSection
        label="Decreto 2.128/SC — NCMs vedadas"
        items={decreto}
        setItems={setDecreto}
        placeholder="7005&#10;2207.10&#10;2710.12.30"
        hint="Aceita prefixos (4 ou 6 digitos) ou NCM completa (8 digitos)."
        minDigits={4}
      />
      <NcmListSection
        label="Lista CAMEX (NCMs sem similar)"
        items={camex}
        setItems={setCamex}
        placeholder="84713019&#10;85176239"
        hint="NCMs completas (8 digitos) ou prefixos (4+ digitos)."
        minDigits={4}
      />
      <NcmListSection
        label="Aco/Cobre — NCMs (prefixos 2+ digitos)"
        items={cobreAco}
        setItems={setCobreAco}
        placeholder="72&#10;73&#10;74&#10;7106"
        hint="4% + aco/cobre = 0,6% recolhimento. Prefixos a partir de 2 digitos."
        minDigits={2}
      />
      <Button
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvando...' : 'Salvar no Firebase'}
      </Button>
    </div>
  );
}

// === NCM List Section (table + search + bulk input) ===

function NcmListSection({
  label, items, setItems, placeholder, hint, minDigits,
}: {
  label: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
  hint: string;
  minDigits: number;
}) {
  const [search, setSearch] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const q = search.replace(/\D/g, '');
  const filtered = q
    ? items.filter(ncm => ncm.includes(q) || formatNcmCode(ncm).includes(search))
    : items;

  const handleRemove = (ncm: string) => {
    setItems(items.filter(n => n !== ncm));
  };

  const handleBulkAdd = () => {
    const parser = minDigits >= 4 ? textToNcmList : textToNcmListShort;
    const newItems = parser(bulkText);
    if (newItems.length === 0) return;
    // Merge without duplicates
    const existing = new Set(items);
    const merged = [...items, ...newItems.filter(n => !existing.has(n))];
    setItems(merged);
    setBulkText('');
    setShowBulkInput(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted px-4 py-2.5 flex items-center gap-3">
        <h3 className="text-sm font-medium text-foreground flex-1">{label}</h3>
        <span className="text-xs text-muted-foreground">{items.length} itens</span>
      </div>

      {/* Search + actions */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar NCM..."
            className="pl-7 pr-3 py-1.5 text-xs font-mono h-8"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={10} />
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowBulkInput(!showBulkInput)}
          className="shrink-0"
        >
          {showBulkInput ? <ChevronUp size={12} /> : <Plus size={12} />}
          {showBulkInput ? 'Fechar' : 'Adicionar em massa'}
        </Button>
      </div>

      {/* Bulk input area */}
      {showBulkInput && (
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <Textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="font-mono"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">{hint} Cole uma NCM por linha.</p>
            <Button
              size="sm"
              onClick={handleBulkAdd}
              disabled={bulkText.trim().length === 0}
            >
              <Plus size={12} />
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* NCM list */}
      <div className="max-h-[280px] overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            {items.length === 0 ? 'Nenhuma NCM cadastrada.' : 'Nenhuma NCM encontrada para a busca.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((ncm, i) => (
              <div key={`${ncm}-${i}`} className="flex items-center justify-between px-4 py-1.5 hover:bg-muted transition-colors group">
                <span className="text-xs font-mono text-foreground">{formatNcmCode(ncm)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(ncm)}
                  className="opacity-0 group-hover:opacity-100 h-auto p-0.5 text-muted-foreground hover:text-destructive transition-all"
                  title="Remover"
                >
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with count when filtering */}
      {search && filtered.length !== items.length && (
        <div className="px-4 py-1.5 bg-muted border-t border-border text-[10px] text-muted-foreground">
          Mostrando {filtered.length} de {items.length} itens
        </div>
      )}
    </div>
  );
}

// === CNPJ Overrides Tab ===

function CnpjOverridesTab({
  overrides, setOverrides, onConfigChanged,
}: {
  overrides: CnpjOverridesFirestore | null;
  setOverrides: (o: CnpjOverridesFirestore) => void;
  onConfigChanged: () => void;
}) {
  const [vedacao25a, setVedacao25a] = useState(listToText(overrides?.vedacao25a ?? []));
  const [vedacao25b, setVedacao25b] = useState(listToText(overrides?.vedacao25b ?? []));
  const [listaCD, setListaCD] = useState(listToText(overrides?.listaCD ?? []));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data: CnpjOverridesFirestore = {
      vedacao25a: textToList(vedacao25a),
      vedacao25b: textToList(vedacao25b),
      listaCD: textToList(listaCD),
    };
    await salvarCnpjOverrides(data);
    setOverrides(data);
    onConfigChanged();
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <NcmTextarea
        label="Vedacao 2.5.a — TTD/Diferimento (CNPJs)"
        value={vedacao25a}
        onChange={setVedacao25a}
        placeholder="12345678000199"
        hint={`${textToList(vedacao25a).length} CNPJs.`}
      />
      <NcmTextarea
        label="Vedacao 2.5.b — Textil/Confeccoes (CNPJs)"
        value={vedacao25b}
        onChange={setVedacao25b}
        placeholder="12345678000199"
        hint={`${textToList(vedacao25b).length} CNPJs.`}
      />
      <NcmTextarea
        label="CD Exclusivo (CNPJs)"
        value={listaCD}
        onChange={setListaCD}
        placeholder="12345678000199"
        hint={`${textToList(listaCD).length} CNPJs.`}
      />
      <Button
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvando...' : 'Salvar no Firebase'}
      </Button>
    </div>
  );
}

// === Shared textarea component (used by CNPJ overrides tab) ===

function NcmTextarea({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div>
      <Label className="mb-1">{label}</Label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="font-mono"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
