# Fase 1B (continuação) — Rotas, Estilos e Páginas Core

## Arquivos a criar/atualizar

### 1. `src/styles.css` (substituir)
Migrar tokens HSL do projeto original (paleta azul Lundgaard, sidebar dark, success/warning), fontes Inter + Space Grotesk, mantendo o formato `@theme inline` do Tailwind v4.

### 2. `src/routes/__root.tsx` (substituir)
Wrap com providers: `QueryClientProvider` + `AuthProvider` + `TooltipProvider` + `<Toaster />` + `<Sonner />` + `<Outlet />`. Lang `pt-BR`, title "Lundgaard Hub".

### 3. `src/routes/index.tsx` (substituir)
Redirect imediato `/` → `/auth` via `beforeLoad`.

### 4. `src/routes/auth.tsx` (criar)
Tela de login + cadastro com Tabs (shadcn). Usa `supabase.auth.signInWithPassword` e `supabase.auth.signUp`. Redireciona para `/hub` quando o user já está logado.

### 5. `src/routes/_authenticated.tsx` (criar)
Layout-route protegido. Checa `useAuth()`, redireciona para `/auth` se não autenticado, renderiza `<AppLayout />` (que já tem `<Outlet />` para os filhos).

### 6. `src/routes/_authenticated/hub.tsx` (criar)
Página Hub idêntica ao original: 5 cards de módulos (Comercial, Financeiro, Operação, Gestão, BI) com gradientes, navegando para suas rotas via `useNavigate`.

## Próximas fases (não nesta)
- Fase 2: criar stubs `/comercial`, `/financeiro`, `/operacao`, `/gestao`, `/bi`, `/admin` para os links da sidebar não quebrarem, depois portar conteúdo real.
- Fase 3: rotas de detalhe (`devis/$id`), aceitar proposta pública, admin/api-keys.
- Fase 4: Edge Functions (quando você tiver as API keys).

**Aprovar para eu aplicar?**
