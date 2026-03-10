import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { TableShowcase } from './components/TableShowcase'
import {
  AlertCircle, CheckCircle2, Info, AlertTriangle, Moon, Sun,
  Search, Mail, Lock, Eye,
} from 'lucide-react'

/* ─── Color swatch helper ─── */
function Swatch({ color, label, textDark = true }: { color: string; label: string; textDark?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-end rounded-lg p-3 min-h-20 min-w-20 shadow-xs border border-border/30"
      style={{ backgroundColor: color }}
    >
      <span className={`text-[10px] font-mono font-medium ${textDark ? 'text-neutral-900' : 'text-white'}`}>
        {label}
      </span>
    </div>
  )
}

function ColorScale({ name, colors }: { name: string; colors: { shade: string; hex: string; light?: boolean }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 text-foreground">{name}</h4>
      <div className="flex gap-1 flex-wrap">
        {colors.map(({ shade, hex, light }) => (
          <Swatch key={shade} color={hex} label={`${shade}\n${hex}`} textDark={light !== false} />
        ))}
      </div>
    </div>
  )
}

/* ─── Section wrapper ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3">{title}</h2>
      {children}
    </section>
  )
}

/* ─── Navigation ─── */
const SECTIONS = [
  'Colors', 'Typography', 'Radius', 'Shadows', 'Buttons', 'Badges',
  'Cards', 'Alerts', 'Forms', 'Tables', 'Skeleton', 'Misc',
]

export function StyleguidePage() {
  const [isDark, setIsDark] = useState(false)
  const [showTableShowcase, setShowTableShowcase] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  if (showTableShowcase) {
    return (
      <div>
        <div className="max-w-6xl mx-auto p-8">
          <Button variant="ghost" onClick={() => setShowTableShowcase(false)} className="mb-4">
            &larr; Voltar ao Design System
          </Button>
        </div>
        <TableShowcase />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Visual Solution</p>
          <h1 className="text-4xl font-bold text-foreground">Design System</h1>
          <p className="text-muted-foreground mt-1">Style Guide &amp; Component Library</p>
        </div>
        <Button variant="outline" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <Button key={s} variant="outline" size="sm" asChild>
            <a href={`#section-${s.toLowerCase()}`}>{s}</a>
          </Button>
        ))}
      </div>

      {/* ─── COLORS ─── */}
      <div id="section-colors">
        <Section title="Color Palette">
          <ColorScale
            name="Primary"
            colors={[
              { shade: '50', hex: '#EEF2FF', light: true },
              { shade: '100', hex: '#DDE5FF', light: true },
              { shade: '200', hex: '#C2D0FF', light: true },
              { shade: '300', hex: '#9BB3FF', light: true },
              { shade: '400', hex: '#7A9AFA', light: false },
              { shade: '500', hex: '#5A81FA', light: false },
              { shade: '600', hex: '#3D63E8', light: false },
              { shade: '700', hex: '#2B4ED4', light: false },
              { shade: '800', hex: '#2340AB', light: false },
              { shade: '900', hex: '#1F3586', light: false },
            ]}
          />
          <ColorScale
            name="Neutral"
            colors={[
              { shade: '50', hex: '#F7F8FC', light: true },
              { shade: '100', hex: '#F1F3F9', light: true },
              { shade: '200', hex: '#E4E7F0', light: true },
              { shade: '300', hex: '#CDD1DC', light: true },
              { shade: '400', hex: '#A8B1CE', light: true },
              { shade: '500', hex: '#8891AB', light: false },
              { shade: '600', hex: '#6A6E83', light: false },
              { shade: '700', hex: '#4E5264', light: false },
              { shade: '800', hex: '#343747', light: false },
              { shade: '900', hex: '#1F1F1F', light: false },
            ]}
          />
          <div>
            <h4 className="text-sm font-semibold mb-2 text-foreground">Semantic</h4>
            <div className="flex gap-1 flex-wrap">
              <Swatch color="#22C55E" label="Success" textDark={false} />
              <Swatch color="#FBB03B" label="Warning" textDark={true} />
              <Swatch color="#EF4444" label="Error" textDark={false} />
              <Swatch color="#5A81FA" label="Info" textDark={false} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 text-foreground">Brand Accents</h4>
            <div className="flex gap-1 flex-wrap">
              <Swatch color="#5A81FA" label="Primary #5A81FA" textDark={false} />
              <Swatch color="#2B318A" label="Dark #2B318A" textDark={false} />
              <Swatch color="#FBB03B" label="Accent #FBB03B" textDark={true} />
            </div>
          </div>
        </Section>
      </div>

      {/* ─── TYPOGRAPHY ─── */}
      <div id="section-typography">
        <Section title="Typography">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Font: <strong>DM Sans</strong> (geometric sans-serif, matching Cygre design)
            </p>
            <div className="space-y-3">
              <h1 className="text-5xl font-bold text-foreground">Heading 1 — 48px Bold</h1>
              <h2 className="text-4xl font-bold text-foreground">Heading 2 — 36px Bold</h2>
              <h3 className="text-3xl font-semibold text-foreground">Heading 3 — 30px Semibold</h3>
              <h4 className="text-2xl font-semibold text-foreground">Heading 4 — 24px Semibold</h4>
              <h5 className="text-xl font-medium text-foreground">Heading 5 — 20px Medium</h5>
              <h6 className="text-lg font-medium text-foreground">Heading 6 — 18px Medium</h6>
            </div>
            <div className="space-y-2 max-w-2xl">
              <p className="text-base text-foreground">
                Body (16px) — The precise geometric design of its symbols makes it suitable for both headings and body copy.
              </p>
              <p className="text-sm text-muted-foreground">
                Small (14px) — Secondary text, labels, and supporting content use a lighter weight and muted color.
              </p>
              <p className="text-xs text-muted-foreground">
                Extra Small (12px) — Captions, footnotes, and metadata.
              </p>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── BORDER RADIUS ─── */}
      <div id="section-radius">
        <Section title="Border Radius">
          <div className="flex gap-4 items-end">
            {[
              { label: 'sm (4px)', cls: 'rounded-sm' },
              { label: 'md (6px)', cls: 'rounded-md' },
              { label: 'lg (8px)', cls: 'rounded-lg' },
              { label: 'xl (12px)', cls: 'rounded-xl' },
              { label: 'full', cls: 'rounded-full' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className={`w-16 h-16 bg-primary ${cls}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── SHADOWS ─── */}
      <div id="section-shadows">
        <Section title="Shadows">
          <div className="flex gap-6 flex-wrap">
            {[
              { label: 'shadow-xs', cls: 'shadow-xs' },
              { label: 'shadow-sm', cls: 'shadow-sm' },
              { label: 'shadow-md', cls: 'shadow-md' },
              { label: 'shadow-lg', cls: 'shadow-lg' },
              { label: 'shadow-xl', cls: 'shadow-xl' },
              { label: 'shadow-card', cls: 'shadow-card' },
            ].map(({ label, cls }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className={`w-24 h-24 bg-card rounded-lg ${cls} border border-border/20`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── BUTTONS ─── */}
      <div id="section-buttons">
        <Section title="Buttons">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Variants</h4>
              <div className="flex gap-3 items-center flex-wrap">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Sizes</h4>
              <div className="flex gap-3 items-center flex-wrap">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon"><Sun className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">States</h4>
              <div className="flex gap-3 items-center flex-wrap">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled Outline</Button>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── BADGES ─── */}
      <div id="section-badges">
        <Section title="Badges">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Variants</h4>
              <div className="flex gap-3 flex-wrap">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Semantic</h4>
              <div className="flex gap-3 flex-wrap">
                <Badge className="bg-success text-success-foreground">Success</Badge>
                <Badge className="bg-warning text-warning-foreground">Warning</Badge>
                <Badge className="bg-success-100 text-success-700 border-success-200/60">OK (light)</Badge>
                <Badge className="bg-warning-100 text-warning-700 border-warning-200/60">Alerta (light)</Badge>
                <Badge className="bg-danger-100 text-danger-700 border-danger-200/60">Erro (light)</Badge>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ─── CARDS ─── */}
      <div id="section-cards">
        <Section title="Cards">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Short description of the card content</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Card body content goes here. This is a sample text to demonstrate the card component.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Metrics</CardTitle>
                <CardDescription>Today's overview</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">1,234</p>
                <p className="text-sm text-success mt-1">+12.5% from last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Current system health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-sm">All systems operational</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-sm">1 service degraded</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>
      </div>

      {/* ─── ALERTS ─── */}
      <div id="section-alerts">
        <Section title="Alerts">
          <div className="space-y-3 max-w-2xl">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Information</AlertTitle>
              <AlertDescription>This is a default informational alert message.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Something went wrong. Please try again.</AlertDescription>
            </Alert>
            <Alert className="border-success/50 text-success [&>svg]:text-success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Operation completed successfully.</AlertDescription>
            </Alert>
            <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>Please review before proceeding.</AlertDescription>
            </Alert>
          </div>
        </Section>
      </div>

      {/* ─── FORMS ─── */}
      <div id="section-forms">
        <Section title="Forms">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {/* Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Input</CardTitle>
                <CardDescription>Text input fields with labels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="input-default">Default</Label>
                  <Input id="input-default" placeholder="Digite algo..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-icon">With icon</Label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="input-icon" placeholder="Buscar..." className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="input-disabled">Disabled</Label>
                  <Input id="input-disabled" placeholder="Desabilitado" disabled />
                </div>
              </CardContent>
            </Card>

            {/* Textarea */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Textarea</CardTitle>
                <CardDescription>Multi-line text input</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textarea-default">Default</Label>
                  <Textarea id="textarea-default" placeholder="Digite uma mensagem..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textarea-mono">Monospace</Label>
                  <Textarea id="textarea-mono" placeholder="8471.30.19&#10;7005.00" className="font-mono" rows={3} />
                </div>
              </CardContent>
            </Card>

            {/* Select */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select</CardTitle>
                <CardDescription>Dropdown selection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>UF Destino</Label>
                  <Select defaultValue="SC">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SC">SC - Santa Catarina</SelectItem>
                      <SelectItem value="SP">SP - Sao Paulo</SelectItem>
                      <SelectItem value="RJ">RJ - Rio de Janeiro</SelectItem>
                      <SelectItem value="PR">PR - Parana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Disabled</Label>
                  <Select disabled defaultValue="sim">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Checkbox & Radio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checkbox & Radio</CardTitle>
                <CardDescription>Toggle and selection controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Checkboxes</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cb1" defaultChecked />
                    <Label htmlFor="cb1" className="cursor-pointer">Pessoa Fisica</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cb2" />
                    <Label htmlFor="cb2" className="cursor-pointer">Industrial</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="cb3" disabled />
                    <Label htmlFor="cb3" className="text-muted-foreground">Disabled</Label>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Radio Group</Label>
                  <RadioGroup defaultValue="option-1" className="space-y-2">
                    {['Option 1', 'Option 2', 'Option 3'].map((label, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <RadioGroupItem value={`option-${i + 1}`} id={`sg-option-${i + 1}`} />
                        <Label htmlFor={`sg-option-${i + 1}`} className="cursor-pointer">{label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form example */}
          <Card className="max-w-md mt-6">
            <CardHeader>
              <CardTitle className="text-base">Login Example</CardTitle>
              <CardDescription>Combining form components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="login-email" type="email" placeholder="email@exemplo.com" className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="login-password" type="password" placeholder="••••••••" className="pl-9" />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" tabIndex={-1}>
                    <Eye size={14} />
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm cursor-pointer">Lembrar de mim</Label>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button className="flex-1">Entrar</Button>
              <Button variant="outline">Cancelar</Button>
            </CardFooter>
          </Card>
        </Section>
      </div>

      {/* ─── TABLES ─── */}
      <div id="section-tables">
        <Section title="Tables">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inline Table</CardTitle>
              <CardDescription>Basic table with footer and status badges</CardDescription>
            </CardHeader>
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
                  {[
                    { id: 'INV001', name: 'Alpha Ltda', status: 'Pago', amount: 1250 },
                    { id: 'INV002', name: 'Beta S.A.', status: 'Pendente', amount: 3150 },
                    { id: 'INV003', name: 'Gamma Ind.', status: 'Atrasado', amount: 8350 },
                  ].map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-medium">{inv.id}</TableCell>
                      <TableCell>{inv.name}</TableCell>
                      <TableCell>
                        <Badge className={
                          inv.status === 'Pago' ? 'bg-success text-success-foreground'
                          : inv.status === 'Pendente' ? 'bg-warning text-warning-foreground'
                          : 'bg-destructive text-destructive-foreground'
                        }>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {inv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {(12750).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => setShowTableShowcase(true)} className="mt-4">
            Ver Table Showcase completo &rarr;
          </Button>
        </Section>
      </div>

      {/* ─── SKELETON ─── */}
      <div id="section-skeleton">
        <Section title="Skeleton">
          <div className="space-y-4 max-w-md">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>
        </Section>
      </div>

      {/* ─── MISC ─── */}
      <div id="section-misc">
        <Section title="Misc">
          <div className="space-y-6 max-w-2xl">
            {/* Separator */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-foreground">Separator</h4>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Content above</p>
                <Separator />
                <p className="text-sm text-muted-foreground">Content below</p>
              </div>
            </div>

            {/* Tooltip */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-foreground">Tooltip</h4>
              <TooltipProvider>
                <div className="flex gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline">Hover me</Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This is a tooltip</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>More information</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* Chart Colors */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-foreground">Chart Colors</h4>
              <div className="flex gap-1">
                {[
                  { label: 'Chart 1', hex: '#5A81FA' },
                  { label: 'Chart 2', hex: '#2B318A' },
                  { label: 'Chart 3', hex: '#FBB03B' },
                  { label: 'Chart 4', hex: '#6A6E83' },
                  { label: 'Chart 5', hex: '#A8B1CE' },
                ].map(({ label, hex }) => (
                  <Swatch key={label} color={hex} label={`${label}\n${hex}`} textDark={false} />
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground py-8 border-t border-border">
        Design System built with shadcn/ui + Tailwind CSS v4 + DM Sans
      </div>
    </div>
  )
}
