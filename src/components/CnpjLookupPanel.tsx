import { useState, useCallback, useEffect, useRef } from 'react';
import type { NfeValidation, CnpjInfo } from '../types/validation.ts';
import type { EmpresaCadastro } from '../firebase/configService.ts';
import { consultarCnpj, getCachedCnpj, getQueueSize } from '../engine/cnpjService.ts';
import { formatCNPJ } from '../utils/formatters.ts';
import { Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type CnpjStatus = 'not_in_db' | 'expired' | 'up_to_date';

function isCurrentMonth(date: Date | undefined): boolean {
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getCnpjStatus(cnpj: string, empresas: EmpresaCadastro[]): { status: CnpjStatus; empresa?: EmpresaCadastro } {
  const empresa = empresas.find(e => e.cnpj === cnpj);
  if (!empresa) return { status: 'not_in_db' };
  if (!isCurrentMonth(empresa.consultadoEm)) return { status: 'expired', empresa };
  return { status: 'up_to_date', empresa };
}

const STATUS_BADGE: Record<CnpjStatus, { label: string; variant: 'destructive' | 'default' | 'secondary'; className?: string }> = {
  not_in_db: { label: 'Nao cadastrado', variant: 'destructive' },
  expired: { label: 'Vencido', variant: 'secondary', className: 'bg-warning-100 text-warning-700 border-transparent' },
  up_to_date: { label: 'Atualizado', variant: 'secondary', className: 'bg-success-100 text-success-700 border-transparent' },
};

interface CnpjLookupPanelProps {
  results: NfeValidation[];
  empresas: EmpresaCadastro[];
  onCnpjInfoLoaded?: (info: CnpjInfo) => void;
  onEmpresasUpdated?: () => void;
}

export function CnpjLookupPanel({ results, empresas, onCnpjInfoLoaded, onEmpresasUpdated }: CnpjLookupPanelProps) {
  const [lookupResults, setLookupResults] = useState<Map<string, CnpjInfo | 'loading' | 'error'>>(new Map());
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const autoConsultTriggered = useRef(false);

  // Collect ALL unique dest CNPJs from results
  const allDestCnpjs = new Set<string>();
  for (const r of results) {
    const cnpj = r.nfe.dest.cnpj;
    if (cnpj) allDestCnpjs.add(cnpj);
  }

  // Compute status for each CNPJ
  const cnpjEntries = Array.from(allDestCnpjs).map(cnpj => {
    const { status, empresa } = getCnpjStatus(cnpj, empresas);
    return { cnpj, status, empresa };
  });

  // Sort: not_in_db first, then expired, then up_to_date; within each group sort by CNPJ
  const statusOrder: Record<CnpjStatus, number> = { not_in_db: 0, expired: 1, up_to_date: 2 };
  cnpjEntries.sort((a, b) => {
    const d = statusOrder[a.status] - statusOrder[b.status];
    if (d !== 0) return d;
    const nameA = a.empresa?.razaoSocial ?? '';
    const nameB = b.empresa?.razaoSocial ?? '';
    return nameA.localeCompare(nameB, 'pt-BR');
  });

  const pendingCnpjs = cnpjEntries.filter(e => e.status !== 'up_to_date');

  const lookupSingle = useCallback(async (cnpj: string) => {
    const cached = getCachedCnpj(cnpj);
    if (cached) {
      setLookupResults(prev => new Map(prev).set(cnpj, cached));
      onCnpjInfoLoaded?.(cached);
      return;
    }

    setLookupResults(prev => new Map(prev).set(cnpj, 'loading'));
    const info = await consultarCnpj(cnpj);
    if (info) {
      setLookupResults(prev => new Map(prev).set(cnpj, info));
      onCnpjInfoLoaded?.(info);
    } else {
      setLookupResults(prev => new Map(prev).set(cnpj, 'error'));
    }
  }, [onCnpjInfoLoaded]);

  const lookupPending = useCallback(async () => {
    const cnpjs = pendingCnpjs.map(e => e.cnpj);
    if (cnpjs.length === 0) return;

    setIsLookingUp(true);
    setProgress({ done: 0, total: cnpjs.length });

    for (let i = 0; i < cnpjs.length; i++) {
      await lookupSingle(cnpjs[i]!);
      setProgress({ done: i + 1, total: cnpjs.length });
    }
    setIsLookingUp(false);
    onEmpresasUpdated?.();
  }, [pendingCnpjs, lookupSingle, onEmpresasUpdated]);

  const lookupAll = useCallback(async () => {
    const allCnpjs = cnpjEntries.map(e => e.cnpj);
    if (allCnpjs.length === 0) return;

    setIsLookingUp(true);
    setProgress({ done: 0, total: allCnpjs.length });

    for (let i = 0; i < allCnpjs.length; i++) {
      await lookupSingle(allCnpjs[i]!);
      setProgress({ done: i + 1, total: allCnpjs.length });
    }
    setIsLookingUp(false);
    onEmpresasUpdated?.();
  }, [cnpjEntries, lookupSingle, onEmpresasUpdated]);

  // Auto-consult pending CNPJs when panel first renders with results
  useEffect(() => {
    if (autoConsultTriggered.current) return;
    if (pendingCnpjs.length === 0) return;
    if (isLookingUp) return;
    autoConsultTriggered.current = true;
    lookupPending();
  }, [pendingCnpjs.length, isLookingUp, lookupPending]);

  if (results.length === 0) return null;

  const queueSize = getQueueSize();

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Search size={14} className="text-primary" />
          </div>
          Consulta CNPJ (OpenCNPJ + CNPJa)
        </CardTitle>
        <CardDescription className="text-xs ml-9">
          Destinatarios identificados nos XMLs. Status baseado no banco de dados Firebase.
          {queueSize > 0 && <span className="ml-2 text-amber-600 font-medium">Fila: {queueSize} pendentes</span>}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button
            size="sm"
            onClick={lookupPending}
            disabled={isLookingUp || pendingCnpjs.length === 0}
          >
            {isLookingUp
              ? `Consultando... (${progress.done}/${progress.total})`
              : `Consultar pendentes (${pendingCnpjs.length})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={lookupAll}
            disabled={isLookingUp || allDestCnpjs.size === 0}
          >
            <RefreshCw size={12} />
            Reconsultar todos ({allDestCnpjs.size})
          </Button>
          <span className="text-xs text-muted-foreground self-center ml-1">
            {allDestCnpjs.size} CNPJs unicos | {cnpjEntries.filter(e => e.status === 'up_to_date').length} atualizados
          </span>
        </div>

        {cnpjEntries.length > 0 && (
          <div className="border border-border rounded-lg overflow-auto max-h-[400px]">
            <Table className="text-xs">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">CNPJ</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">Razao Social</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">Simples</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">MEI</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">CNAE Principal</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">Industrial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cnpjEntries.map(({ cnpj, status, empresa }) => {
                  const lookupData = lookupResults.get(cnpj);
                  const badge = STATUS_BADGE[status];
                  // Use empresa data for display if available, or lookup result
                  const info: CnpjInfo | undefined = lookupData && typeof lookupData === 'object'
                    ? lookupData as CnpjInfo
                    : empresa ? {
                      cnpj: empresa.cnpj,
                      razaoSocial: empresa.razaoSocial,
                      simplesOptante: empresa.simplesOptante,
                      isMei: empresa.isMei,
                      cnaePrincipal: empresa.cnaePrincipal,
                      cnaeDescricao: empresa.cnaeDescricao,
                      cnaesSecundarios: [],
                      isIndustrial: empresa.industrialOverride !== undefined ? empresa.industrialOverride : empresa.isIndustrial,
                    } : undefined;

                  return (
                    <TableRow key={cnpj}>
                      <TableCell className="px-3 py-2">
                        <Badge
                          variant={badge.variant}
                          className={cn("text-[10px]", badge.className)}
                        >
                          {lookupData === 'loading' ? 'Consultando...' : badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 font-mono text-foreground">{formatCNPJ(cnpj)}</TableCell>
                      {lookupData === 'loading' ? (
                        <TableCell colSpan={5} className="px-3 py-2 text-muted-foreground italic">Consultando...</TableCell>
                      ) : lookupData === 'error' ? (
                        <TableCell colSpan={5} className="px-3 py-2 text-destructive">
                          Erro na consulta
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => lookupSingle(cnpj)}
                            className="ml-2"
                          >
                            Tentar novamente
                          </Button>
                        </TableCell>
                      ) : info ? (
                        <>
                          <TableCell className="px-3 py-2 truncate max-w-[200px] text-foreground" title={info.razaoSocial}>
                            {info.razaoSocial || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            {info.simplesOptante === true && (
                              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200/60">SN</Badge>
                            )}
                            {info.simplesOptante === false && (
                              <Badge variant="outline" className="text-[10px]">Nao</Badge>
                            )}
                            {info.simplesOptante === null && <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            {info.isMei === true && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200/60">MEI</Badge>
                            )}
                            {info.isMei === false && (
                              <Badge variant="outline" className="text-[10px]">Nao</Badge>
                            )}
                            {info.isMei === null && <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <div className="font-mono text-foreground">{info.cnaePrincipal || '-'}</div>
                            {info.cnaeDescricao && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[180px] leading-tight mt-0.5" title={info.cnaeDescricao}>{info.cnaeDescricao}</div>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            {info.isIndustrial ? (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200/60">Sim</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Nao</Badge>
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={5} className="px-3 py-2 text-muted-foreground italic">
                          Aguardando consulta...
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
