# Contexto Técnico para Design System (Stitch)
Este documento descreve a arquitetura, stack tecnológica e o estado atual do projeto **ICMS Auditor**, servindo como base para um novo planejamento de UI/UX.

## 1. Stack Tecnológica
- **Framework**: React 19 (TypeScript)
- **Bundler**: Vite 7
- **Estilização**: TailwindCSS v4
- **Componentes**: Radix UI + Lucide React para ícones
- **Backend/Storage**: Firebase (Firestore para regras e cadastros)
- **Manipulação de Dados**: `xlsx` (Excel), `fflate` (ZIP), `file-saver` (Exports)

## 2. Arquitetura de Layout
O projeto utiliza um layout de **SaaS Dashboard** moderno:
- **Sidebar (Navegação Lateral)**: Cor Deep Blue Slate (`#0F172A`). Contém o logo da Prime e os links de navegação.
- **TopBar (Barra Superior)**: Flutuante, contém o título da página atual e ações de contexto (Limpar, Exportar, Sair).
- **Conteúdo Principal**: Área central com scroll independente, fundo em gradiente suave.
- **Micro-interações**: Uso extensivo de `backdrop-blur`, `shadow-card` e transições suaves entre estados.

## 3. Páginas e Funcionalidades
1.  **Auditor (Main)**:
    - Área de DropZone (XML/ZIP) com estados de hover e progresso.
    - Dashboard de KPIs (Cards grandes com métricas financeiras).
    - Agrupamento de filtros (Grid de micro-tabelas clicáveis).
    - Lista de Notas Fiscais (Tabela ou Cards detalhados com status de erro/sucesso).
2.  **Simulador TTD 410**:
    - Formulário complexo com múltiplos campos (CNPJ, Razão Social, UF, Regime).
    - Grid dinâmica de itens (NCMs).
    - Tabela de resultados com cálculos detalhados de ICMS e Fundos.
3.  **Regras & Cadastros**:
    - Gerenciamento de listas (NCMs, CNPJs Vedados).
    - Editores de regras com nesting (Cenários Fiscais).

## 4. Design Tokens Atuais (index.css)
*Baseados em CSS Variables aplicadas no `@theme` do Tailwind v4.*

### Cores Core
- **Primary**: `#5A81FA` (Azul Vibrante)
- **Primary Dark**: `#2B318A` (Azul Profundo)
- **Accent**: `#FBB03B` (Ouro/Laranja)
- **Background**: `#F7F8FC` (Cinza muito claro/Azulado)
- **Sidebar**: `#0F172A`

### Tipografia
- **Fonte**: "DM Sans" (Geometric Sans-serif)
- **Hierarquia**: Uso de `tracking-tight` para títulos e `font-mono` (`tabular-nums`) para valores financeiros.

### Sombras e Bordas
- `--radius`: `0.625rem` (10px)
- `--shadow-card`: Sombras leves e suaves para dar profundidade.
- `--shadow-card-hover`: Expansão da sombra no hover para efeito de elevação.

## 5. Objetivo para o Novo Design
- **Estética**: Premium, limpo, alta densidade de informação sem poluição visual.
- **Foco**: Transformar as tabelas e formulários em algo mais próximo de ferramentas como Stripe, Vercel ou Linear.
- **Consistência**: Garantir que todos os componentes (inputs, selects, badges) sigam os novos tokens.

## 6. Restrições Técnicas
- Manter o uso de **TailwindCSS v4**.
- Não usar bibliotecas de UI pesadas externas se o Shadcn/UI puder resolver.
- Preservar a lógica de estados do React atual.
