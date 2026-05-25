# Auditoria Técnica — Lundgaard Hub

Diagnóstico baseado em leitura do código, schema, índices, RLS e volumetria atual (≤ 20 linhas por tabela em produção/teste). Nada será alterado até sua aprovação. Ao final, plano de ação priorizado.

---

## 1. Estrutura geral

**Problemas observados:**
- Rotas-página gigantes concentrando dados + UI + mutations:
  - `conciliacao.tsx` (1064 linhas), `admin.tsx` (1004), `comercial.tsx` (780), `financeiro.tsx` (691), `comercial_.devis.$id.tsx` (556).
  - Cada uma mistura: queries Supabase diretas, lógica de negócio, dialogs, formulários, listagens. Difícil manter por 25+ pessoas.
- Acesso direto ao `supabase.from(...)` em ~40 pontos do frontend. Não há camada de "services/repositories" — toda regra fica espalhada em componentes.
- Pasta `src/lib/` mistura helpers (utils, parseOfx, error-page, exportPdf) sem subpastas por domínio.
- Hooks personalizados praticamente inexistentes (`useFxRates` é o único). Lógica de fetch é repetida.

**Recomendado (a confirmar):**
- Criar `src/features/<dominio>/` (comercial, financeiro, conciliacao, operacao, admin) contendo: `api/` (queries), `hooks/`, `components/`, `types.ts`.
- Extrair queries/mutations para `createServerFn` ou hooks `useQuery`/`useMutation` reutilizáveis (já temos TanStack Query no projeto).
- Quebrar as 5 rotas grandes em sub-componentes (formulário, tabela, dialog, filtros) com no máx ~250 linhas cada.

---

## 2. Banco de dados Supabase

**Problemas:**
- **Foreign keys ausentes** em praticamente todas as tabelas (`devis.client_id`, `services.devis_id`, `financial_entries.bank_account_id`, `bank_statement_entries.bank_account_id`, `conciliation_matches.*`, `clients.business_unit_id` etc). O schema lista "No foreign keys" para todas. Risco de órfãos e dados inconsistentes.
- **Índices faltando** em colunas usadas em joins/filtros:
  - `devis(client_id)`, `devis(status)`, `devis(created_at)`, `devis(business_unit)`, `devis(accept_token)` (este último crítico para a página pública de aceite).
  - `services(devis_id)`, `services(client_id)`, `services(status)`, `services(expected_end_date)`.
  - `clients(business_unit_id)`, `clients(name)` (busca).
  - `conciliation_matches(bank_statement_entry_id)`, `conciliation_matches(financial_entry_id)`, `conciliation_matches(status)`.
  - `audit_logs(user_id)`, `audit_logs(created_at)`, `audit_logs(entity_type, entity_id)`.
  - `user_roles(role)` — usado em joins de RLS.
- **Paginação ausente:** queries fazem `select("*").limit(200)` ou sem limit. Com crescimento (12 meses de financeiro = milhares de linhas), telas vão travar.
- **`select("*")` em todo lugar** — paga banda e quebra com novas colunas. Deveria selecionar colunas usadas.
- **`devis` removido do realtime** (correção de segurança recente), mas Kanban/listagens podem se beneficiar de invalidação por evento — hoje só refetch manual.
- Tabelas sem `updated_at` automatizado em `audit_logs`, `user_roles`, `conciliation_matches`.

---

## 3. Segurança e permissões

**Bom:**
- `user_roles` com enum + função `has_role` SECURITY DEFINER (padrão correto).
- RLS por papel já aplicada (admin/comercial/financeiro/operacao) após migração recente.
- Policy RESTRICTIVE em `user_roles` previne auto-promoção.
- Storage `devis-pdfs` privado, scoped por papel.

**Problemas / lacunas:**
- Não existe papel **gestor** (intermediário entre admin e usuário) que você pediu. Hoje só: admin, comercial, financeiro, operacao.
- **`services` tem SELECT aberto a qualquer authenticated** (`USING (true)`) — qualquer usuário logado vê todos os serviços. Provavelmente deveria ser scoped por papel/operação.
- **`business_units` e `system_settings`** também com SELECT para todo authenticated — aceitável, mas confirmar.
- Frontend não checa papel antes de renderizar rotas. Qualquer logado pode digitar `/financeiro` e a tela carrega (RLS impede dados, mas UX fica quebrada e revela estrutura).
- `accept-devis-proposal` (edge function pública) precisa rate-limit/captcha para evitar bots.
- Senha mínima 6 caracteres no signup admin (`manage-users`) — fraco para produção.
- **Leaked Password Protection (HIBP)** parece desligado — recomendado ativar.
- Sem **MFA** para admins.

---

## 4. Performance

**Pontos críticos:**
- `comercial.tsx` carrega TODOS clientes, TODOS devis, TODOS profiles, TODAS entradas financeiras, TODOS serviços de uma vez ao abrir a tela. Vai degradar rapidamente.
- `financeiro.tsx` busca `financial_entries` sem paginação.
- `conciliacao.tsx` faz 3 queries de até 200 registros + várias mutations sequenciais (deveria ser transação no servidor).
- `admin.tsx` (1000 linhas) provavelmente carrega tudo: usuários, papéis, configs.
- Sem React Query cache compartilhado entre páginas — cada navegação refaz fetch.
- `defaultPreloadStaleTime: 0` no router força refetch a cada hover de Link.
- Componentes grandes sem `React.memo`, listas sem virtualização.

**Recomendado:**
- Paginação server-side (range/cursor) em todas as listagens.
- Filtros (data, status, cliente) aplicados na query, não no cliente.
- Mover agregações de dashboard (já existem `bi_kpis_*`) para uso direto em vez de calcular no client.
- Virtualização (`@tanstack/react-virtual`) em tabelas > 100 linhas.
- React Query com `staleTime` razoável (30s-2min) para listas estáveis.

---

## 5. Operação em produção

**Bom:**
- Secrets em Lovable Cloud (Supabase vault), não no código.
- Branded error page (`error-page.ts`) e captura SSR (`error-capture.ts`).

**Problemas:**
- Sem **observabilidade**: nenhum Sentry/Logflare. Erros em produção só aparecem em `console.error`.
- `audit_logs` existe mas não é populado consistentemente (busquei e não há writes na maioria dos fluxos de mutação).
- Sem **rate limiting** nas edge functions públicas (`accept-devis-proposal`, `api/public/*`).
- Backup: Supabase faz daily, mas não há rotina documentada de restore-test.
- Edge functions usam `Deno.serve` antigo e fazem `console.error` cru; nada agregado.
- `manage-users` edge function ainda em uso — deveria migrar para `createServerFn` (padrão atual TanStack).

---

## 6. UX

- Sidebar lista todos os módulos mesmo sem permissão (precisa filtrar por `has_role`).
- Loading states inconsistentes (alguns spinners, alguns skeletons, alguns nada).
- Formulários grandes (devis, financeiro) sem validação client-side estruturada (Zod + react-hook-form) — só HTML5 `required`.
- Toasts duplicados (existe `Toaster` + `Sonner` montados juntos no `__root.tsx`).
- Sem confirmação em ações destrutivas em alguns pontos (deleção de match em conciliação).

---

## 7. Escalabilidade

**Gargalos previstos com 50–100 usuários:**
- Banco: sem FKs nem índices, queries com `select *` e sem paginação vão explodir.
- Realtime: se reativado em devis/services para Kanban colaborativo, cada cliente recebe TUDO sem filtro.
- Frontend: bundle único, sem code-splitting por módulo (TanStack faz por rota, mas componentes pesados como PDF template e parseOfx vão para o bundle inicial).
- Edge functions com cold-start a cada chamada — para BI considerar materialized views.
- Sem fila/job real para PDFs, e-mails massivos (hoje pgmq para e-mail está OK, mas PDF é síncrono).

---

# Relatório consolidado

## A. Problemas críticos (corrigir antes de produção real)
1. **Foreign keys ausentes** em todas as tabelas relacionais → risco de dados órfãos.
2. **Índices faltando** em `devis.accept_token`, `services.devis_id`, `devis.client_id`, `clients.business_unit_id`, `conciliation_matches.*`, `audit_logs.*`.
3. **`services` com SELECT aberto a todos os authenticated** — fuga de dados entre setores.
4. **Listagens sem paginação** em comercial/financeiro/conciliacao — vão travar com volume real.
5. **Frontend não valida papel** para renderizar rotas e sidebar.
6. **Sem rate-limit** em endpoints públicos (`accept-devis-proposal`).
7. **Sem observabilidade** de erros em produção.

## B. Melhorias recomendadas
1. Refatorar rotas > 500 linhas em `features/<dominio>/` com hooks reutilizáveis.
2. Adotar `createServerFn` no lugar das queries Supabase diretas no frontend (centraliza regras, melhora segurança e cache).
3. Adicionar papel **gestor** e revisar a matriz de permissões por módulo.
4. Auditoria automática: trigger genérico que escreve em `audit_logs` em INSERT/UPDATE/DELETE das tabelas sensíveis.
5. Filtrar Sidebar e rotas pelo papel do usuário.
6. Habilitar HIBP (leaked password) e exigir senhas ≥ 12 caracteres para admins.
7. Substituir `select("*")` por colunas explícitas.
8. Padronizar loading/empty/error states (criar `<DataState />` componente).
9. Validação com Zod + react-hook-form em formulários grandes.
10. Migrar `manage-users` (edge function) para `createServerFn`.

## C. Ajustes opcionais
1. Virtualização de tabelas (react-virtual).
2. MFA para admins.
3. Realtime seletivo no Kanban de devis com filtro por business_unit.
4. Materialized views para dashboards BI.
5. Storybook ou playground de componentes para padronização visual.
6. Testes automatizados (Vitest) cobrindo regras críticas (cálculo de cobrança 50%, FX, conciliação).

## D. Riscos para produção
- **Integridade**: ausência de FKs pode gerar inconsistência permanente que precisa script de cura.
- **Performance**: listas sem paginação podem derrubar a tela quando passar de ~2000 lançamentos financeiros.
- **Segurança**: `services` SELECT aberto + sem rate-limit no aceite público são vetores reais.
- **Suporte**: sem Sentry, debug em produção depende de relato manual.
- **Manutenção**: arquivos de 1000+ linhas dificultam onboarding e geram conflitos de merge.

## E. Plano de ação por prioridade

**Sprint 1 (1–3 dias) — críticos:**
1. Migração: adicionar FKs com `ON DELETE` apropriado em todas as relações.
2. Migração: criar índices faltantes (lista da seção 2).
3. Migração: restringir RLS de `services` por papel (admin/operacao + comercial leitura).
4. Filtrar sidebar/rotas no frontend por papel (`has_role` hook).
5. Habilitar HIBP + aumentar senha mínima.

**Sprint 2 (3–5 dias) — performance & UX:**
6. Paginação server-side em comercial/financeiro/conciliacao.
7. Substituir `select("*")` pelas colunas necessárias.
8. Padronizar loading/empty/error.
9. Adicionar Zod + react-hook-form nos formulários grandes.

**Sprint 3 (5–7 dias) — arquitetura:**
10. Reorganizar em `src/features/<dominio>/`, quebrar rotas grandes.
11. Migrar queries para `createServerFn` (começando por comercial e financeiro).
12. Auditoria automática via trigger.
13. Migrar `manage-users` para serverFn.

**Sprint 4 — observabilidade & escala:**
14. Sentry (ou similar) no frontend e SSR.
15. Rate-limit em `/api/public/*` e edge functions públicas.
16. Adicionar papel `gestor` + revisão de matriz.
17. Virtualização de tabelas grandes.

---

**Próximo passo:** me diga por onde quer começar (sugiro Sprint 1: críticos de segurança + integridade do banco), ou se prefere ajustar prioridades/escopo deste plano antes de executar.
