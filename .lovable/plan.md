## Objetivo

Replicar o projeto `julinTec/hub-manager-lundgaard` neste projeto Lovable, mantendo layout, componentes, rotas, lógica e estrutura de banco idênticos ao original.

## Etapas

### 1. Baixar e inspecionar o repositório
- Clonar o repo público via `git clone` em `/tmp`.
- Mapear a estrutura: framework usado (Vite + React Router clássico, ou já TanStack Start), dependências do `package.json`, pastas `src/`, `supabase/`, `public/`.
- Listar todas as páginas, componentes, hooks, libs e assets.

### 2. Sincronizar dependências
- Comparar `package.json` do original com o atual e instalar pacotes faltantes via `bun add`.
- Manter as versões já presentes no template Lovable (TanStack Start, Tailwind v4, shadcn) quando houver conflito.

### 3. Copiar o código-fonte
- Copiar `src/components/`, `src/hooks/`, `src/lib/`, `src/integrations/`, `src/contexts/` e quaisquer pastas equivalentes.
- Copiar assets de `public/` e `src/assets/`.
- Copiar estilos globais (mesclando com `src/styles.css` atual para preservar tokens do design system, se o original usar os mesmos).

### 4. Adaptar o roteamento
- O template atual usa **TanStack Start** (file-based routing em `src/routes/`).
- Se o original usa `react-router-dom` com `<Routes>` em `App.tsx`, converter cada rota em um arquivo em `src/routes/` (ex.: `/dashboard` → `src/routes/dashboard.tsx`), mantendo o componente da página intacto.
- Trocar imports de `react-router-dom` por `@tanstack/react-router` (`Link`, `useNavigate`, `useParams`).
- Atualizar `src/routes/__root.tsx` com providers globais (Theme, Auth, Toaster, etc.) que estiverem no `App.tsx` original.

### 5. Recriar o banco de dados (se aplicável)
- Se o repo tem `supabase/migrations/`, aplicar as migrations no Lovable Cloud deste projeto para recriar tabelas, RLS policies, functions e triggers idênticas.
- Recriar edge functions, se houver, em `supabase/functions/` → adaptar para server functions do TanStack Start ou manter como rotas em `src/routes/api/`.
- **Dados (registros) não são migrados automaticamente** — você precisará exportar CSVs do projeto original e reimportar.

### 6. Configurar secrets
- Listar quaisquer variáveis de ambiente referenciadas no código original.
- Pedir as chaves necessárias (Stripe, APIs externas) para configurar como secrets do Lovable Cloud.

### 7. Validação visual
- Rodar a preview, navegar por cada página e comparar com o repo original.
- Corrigir imports quebrados, rotas faltantes e ajustes de SSR (componentes que usam `window` precisam ser client-only no TanStack Start).

## Detalhes técnicos

- **Conversão de roteamento** é o ponto mais sensível. Projetos Lovable mais antigos usam `react-router-dom` v6 com `BrowserRouter` em `main.tsx` e `<Routes>` em `App.tsx`. O template atual já é TanStack Start, então cada `<Route path="/x" element={<X />} />` vira um arquivo `src/routes/x.tsx` exportando `createFileRoute("/x")({ component: X })`.
- Componentes shadcn/ui já existem aqui — não vamos sobrescrever os do template a menos que haja diferenças importantes.
- A geração de `routeTree.gen.ts` é automática.

## O que NÃO será replicado automaticamente
- Registros do banco de dados original.
- Usuários cadastrados na auth original.
- Secrets/API keys.
- Histórico de versões do projeto Lovable original.

## Próximo passo
Aprove o plano e eu inicio o clone + análise detalhada do repositório, te reportando o que encontrei antes de fazer alterações destrutivas.