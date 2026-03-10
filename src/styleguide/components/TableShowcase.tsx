import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

/* ─── Sample data ─── */
const invoices = [
  { id: 'INV001', customer: 'Empresa Alpha Ltda', status: 'Pago', method: 'PIX', amount: 1250.0 },
  { id: 'INV002', customer: 'Beta Comercio S.A.', status: 'Pendente', method: 'Boleto', amount: 3150.0 },
  { id: 'INV003', customer: 'Gamma Industrias', status: 'Atrasado', method: 'Transferencia', amount: 8350.0 },
  { id: 'INV004', customer: 'Delta Servicos ME', status: 'Pago', method: 'Cartao', amount: 450.0 },
  { id: 'INV005', customer: 'Epsilon Tech Ltda', status: 'Pago', method: 'PIX', amount: 5500.0 },
  { id: 'INV006', customer: 'Zeta Logistica', status: 'Pendente', method: 'Boleto', amount: 2200.0 },
  { id: 'INV007', customer: 'Eta Consultoria', status: 'Atrasado', method: 'Transferencia', amount: 7300.0 },
  { id: 'INV008', customer: 'Theta Alimentos', status: 'Pago', method: 'PIX', amount: 980.0 },
]

const nfeData = [
  { chave: '3524...0001', emitente: 'Alpha Ltda', cfop: '5102', valor: 12500.0, icms: 2250.0, status: 'Conforme' },
  { chave: '3524...0002', emitente: 'Beta S.A.', cfop: '5949', valor: 8700.0, icms: 0.0, status: 'Isento' },
  { chave: '3524...0003', emitente: 'Gamma Ind.', cfop: '6102', valor: 45000.0, icms: 5400.0, status: 'Divergente' },
  { chave: '3524...0004', emitente: 'Delta ME', cfop: '5102', valor: 3200.0, icms: 576.0, status: 'Conforme' },
  { chave: '3524...0005', emitente: 'Epsilon Tech', cfop: '5102', valor: 18900.0, icms: 3402.0, status: 'Conforme' },
]

function statusBadge(status: string) {
  switch (status) {
    case 'Pago':
    case 'Conforme':
      return <Badge className="bg-success text-success-foreground">{status}</Badge>
    case 'Pendente':
    case 'Isento':
      return <Badge className="bg-warning text-warning-foreground">{status}</Badge>
    case 'Atrasado':
    case 'Divergente':
      return <Badge variant="destructive">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/* ─── Section wrapper ─── */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function TableShowcase() {
  const [sortField, setSortField] = useState<'amount' | 'customer' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 4

  const toggleSort = (field: 'amount' | 'customer') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedInvoices = [...invoices].sort((a, b) => {
    if (!sortField) return 0
    const mult = sortDir === 'asc' ? 1 : -1
    if (sortField === 'amount') return (a.amount - b.amount) * mult
    return a.customer.localeCompare(b.customer) * mult
  })

  const paginatedInvoices = sortedInvoices.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(invoices.length / pageSize)

  return (
    <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">Components</p>
        <h1 className="text-3xl font-bold text-foreground">Table</h1>
        <p className="text-muted-foreground mt-1">
          A responsive table component for displaying structured data with sorting, pagination, and status badges.
        </p>
      </div>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
{`import {
  Table, TableBody, TableCaption, TableCell,
  TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'`}
          </pre>
        </CardContent>
      </Card>

      {/* ─── Basic Table ─── */}
      <Section title="Basic Table" description="Simple table with header, body, footer, and caption.">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableCaption>Lista de faturas recentes.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fatura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.slice(0, 5).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium font-mono text-xs">{inv.id}</TableCell>
                    <TableCell>{inv.customer}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell>{inv.method}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(inv.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatBRL(invoices.slice(0, 5).reduce((sum, inv) => sum + inv.amount, 0))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* ─── Sortable + Paginated Table ─── */}
      <Section title="Sortable & Paginated" description="Click column headers to sort. Navigate pages with buttons.">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fatura</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => toggleSort('customer')}>
                      Cliente
                      <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" className="-mr-3 h-8 ml-auto" onClick={() => toggleSort('amount')}>
                      Valor
                      <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium font-mono text-xs">{inv.id}</TableCell>
                    <TableCell>{inv.customer}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell>{inv.method}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(inv.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, invoices.length)} de {invoices.length}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── Domain-specific: NF-e Audit Table ─── */}
      <Section title="NF-e Audit Table" description="Domain-specific table for tax auditing with CFOP, ICMS values, and compliance status.">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auditoria ICMS</CardTitle>
            <CardDescription>Notas fiscais analisadas com status de conformidade</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave NF-e</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead className="text-center">CFOP</TableHead>
                  <TableHead className="text-right">Valor NF</TableHead>
                  <TableHead className="text-right">ICMS</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfeData.map((nfe) => (
                  <TableRow key={nfe.chave}>
                    <TableCell className="font-mono text-xs">{nfe.chave}</TableCell>
                    <TableCell>{nfe.emitente}</TableCell>
                    <TableCell className="text-center font-mono">{nfe.cfop}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(nfe.valor)}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(nfe.icms)}</TableCell>
                    <TableCell className="text-center">{statusBadge(nfe.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Totais</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatBRL(nfeData.reduce((sum, n) => sum + n.valor, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatBRL(nfeData.reduce((sum, n) => sum + n.icms, 0))}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* ─── Striped Table ─── */}
      <Section title="Striped Rows" description="Alternating row colors for better readability using even/odd selectors.">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fatura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv, i) => (
                  <TableRow key={inv.id} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                    <TableCell className="font-medium font-mono text-xs">{inv.id}</TableCell>
                    <TableCell>{inv.customer}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(inv.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* ─── Empty State ─── */}
      <Section title="Empty State" description="How the table looks when there is no data.">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fatura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhum resultado encontrado.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* ─── Props Reference ─── */}
      <Section title="Component Reference">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Component</TableHead>
                  <TableHead>HTML Element</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { comp: 'Table', el: '<table>', desc: 'Root wrapper with horizontal scroll overflow' },
                  { comp: 'TableHeader', el: '<thead>', desc: 'Groups header rows with bottom border' },
                  { comp: 'TableBody', el: '<tbody>', desc: 'Groups body rows, removes last row border' },
                  { comp: 'TableFooter', el: '<tfoot>', desc: 'Footer with muted background for totals' },
                  { comp: 'TableRow', el: '<tr>', desc: 'Row with hover state and selected state support' },
                  { comp: 'TableHead', el: '<th>', desc: 'Header cell with muted text and medium font' },
                  { comp: 'TableCell', el: '<td>', desc: 'Body cell with consistent padding' },
                  { comp: 'TableCaption', el: '<caption>', desc: 'Table description shown below the table' },
                ].map(({ comp, el, desc }) => (
                  <TableRow key={comp}>
                    <TableCell className="font-mono text-sm font-medium">{comp}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{el}</TableCell>
                    <TableCell className="text-sm">{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      {/* ─── Accessibility ─── */}
      <Section title="Accessibility">
        <Card>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>- Uses semantic HTML table elements (<code className="text-foreground bg-muted px-1 rounded">table</code>, <code className="text-foreground bg-muted px-1 rounded">thead</code>, <code className="text-foreground bg-muted px-1 rounded">tbody</code>, etc.)</p>
            <p>- Screen readers automatically announce row/column headers</p>
            <p>- <code className="text-foreground bg-muted px-1 rounded">TableCaption</code> provides accessible table description</p>
            <p>- Selected rows use <code className="text-foreground bg-muted px-1 rounded">data-state="selected"</code> for visual and accessible state</p>
            <p>- Keyboard navigation works natively through table cells</p>
          </CardContent>
        </Card>
      </Section>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-8 border-t border-border">
        Table component from shadcn/ui
      </div>
    </div>
  )
}
