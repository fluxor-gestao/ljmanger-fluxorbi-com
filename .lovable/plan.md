# Plano — Fase 1B: Adaptação de Rotas, Providers e Páginas Core

Continuar a replicação do `hub-manager-lundgaard`, agora focando em fazer o app rodar de fato no TanStack Start.

## 1. Dependências
Instalar via `bun add`:
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (Kanban de devis)
- `jspdf`, `html2canvas` (export PDF)
- `xlsx` (import/export planilhas)
- `next-themes` (dark mode)
- `date-fns`, `recharts` (se ainda faltarem)

## 2. Adaptação de Imports
Substituir em todos os componentes copiados:
- `react-router-dom` → `@tanstack/react-router`
- `<Outlet />`, `useNavigate`, `Link`, `NavLink` adaptados à API do TanStack
- `AppLayout.tsx` e `NavLink.tsx` reescritos para TanStack
- `AuthContext` mantido como provider React puro (sem mudanças)

## 3. Estilos (src/styles.css)
Importar do projeto original:
- Tokens de cor HSL convertidos para o padrão atual (`@theme` Tailwind v4)
- Fontes, radius, sombras, gradientes da marca Lundgaard
- Classes utilitárias customizadas (kanban, devis-pdf-page, etc.)

## 4. Estrutura de Rotas (`src/routes/`)
Converter as 12 páginas originais em rotas file-based:

```
src/routes/
  __root.tsx              (providers: QueryClient, Auth, Toaster, Tooltip)
  index.tsx               (redirect → /hub se logado, → /auth se não)
  auth.tsx                (Login + Signup)
  _authenticated.tsx      (guard: exige sessão Supabase)
  _authenticated/
    hub.tsx               (Dashboard principal)
    devis.tsx             (Lista + Kanban de propostas)
    devis.$id.tsx         (Detalhe da proposta)
    clientes.tsx
    financeiro.tsx
    operacao.tsx
    configuracoes.tsx
    api-keys.tsx
```

Nesta fase implementamos: `__root`, `index`, `auth`, `_authenticated` guard e `hub` (placeholder funcional). As demais páginas ficam como stubs navegáveis.

## 5. Auth Flow
- Página `/auth` com tabs Login/Cadastro (email + senha + Google OAuth)
- `_authenticated.tsx` com `beforeLoad` checando `supabase.auth.getUser()`
- Redirect para `/auth` quando não autenticado, com `redirect` search param
- Após login → redireciona para `/hub`

## 6. Root Layout
`__root.tsx` envolverá:
- `QueryClientProvider`
- `AuthProvider` (do AuthContext já copiado)
- `TooltipProvider`
- `<Toaster />` (shadcn) + `<Sonner />`
- `<Outlet />`

## 7. Hub (página inicial pós-login)
Cards de resumo + atalhos para os módulos. Layout idêntico ao original (sidebar + header + grid de KPIs), com dados reais das tabelas `devis`, `financial_entries`, `clients` quando disponíveis.

## 8. O que NÃO entra nesta fase
- Páginas detalhadas de Devis/Financeiro/Operação (stubs apenas)
- Edge Functions (próxima fase, quando você tiver as API keys)
- Tela de envio de proposta com geração de PDF integrada

## Próximas fases (depois desta)
- **Fase 2**: páginas Devis (lista + kanban + detalhe + validação)
- **Fase 3**: Financeiro + Clientes + Operação
- **Fase 4**: Edge Functions (IA, PDF parsing, envio de email) — exige API keys

---

**Aprovar para eu executar a Fase 1B?**
