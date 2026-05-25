
# Bloco 2 — Comercial, Financeiro, Conciliação

## Diagnóstico

### Comercial (`src/routes/_authenticated/comercial.tsx`)
Queries atuais:
- `clients` → `select("*")` sem limit, sem filtro server-side.
- `devis` → `select("*")` sem limit, sem filtros (filtros rodam em memória via `filteredDevis`).
- `profiles-all` → leve, ~25 linhas, mantém como está.
- `devis-financial-entries` → carrega todos os FE com `document_reference` para calcular indicadores.
- `devis-services` → carrega todos os services com `devis_id` para indicadores.

Problema central: indicadores (`devisIndicators`) e Kanban dependem da lista inteira de devis carregada em memória. Paginar a tabela quebra os indicadores e o Kanban.

### Financeiro (`src/routes/_authenticated/financeiro.tsx`)
Queries atuais:
- `financial-entries` → `select("*")` com `.limit(500)` fixo. Filtros de competence/business/search já vão ao banco, mas bankFilter/typeFilter/statusFilter/originFilter/realizedFilter rodam em memória.
- Métricas (`metrics`, `analitico`) calculadas no frontend sobre `filtered`. Se a base crescer, o `.limit(500)` corta dados e os totais ficam incorretos.

### Conciliação (`src/routes/_authenticated/conciliacao.tsx`)
Queries atuais:
- `bank-statements` → `select("*")` `.limit(200)`.
- `financial-entries-conciliation` → `select("*")` `.eq pendente` `.limit(200)`.
- `conciliation-matches` → `select("*")` sem limit.

Problema central: matching automático (`suggestMatches`, `autoSuggest`, `matchScore`, `pairedRows`) percorre as duas listas inteiras em memória cruzando-as. Paginar essas listas quebra o algoritmo de pareamento.

## Plano de execução

### Passo 1 — Comercial
**Princípio:** separar "dados para indicadores/Kanban" (resumo leve, agregado no banco) de "dados para tabela" (paginado).

1. Criar agregados server-side para os 4 cards e Kanban:
   - Indicadores: usar `bi_kpis_comercial` já existente (já roda no banco) OU adicionar uma query simples `select('status, accepted_at, sent_at, total_amount').range(0, 5000)` apenas para os cards/Kanban — mantém o comportamento atual sem `select("*")`.
   - Kanban continua usando esse payload reduzido (precisa de todos os devis para agrupar por status).
2. Tabela de devis (modo "list"):
   - Query separada `['devis','list', {page, status, businessUnit, clientId, q}]` com paginação server-side (20/pág), colunas explícitas (`id, devis_number, title, status, total_amount, business_unit, client_id, created_at, sent_at, accepted_at, deadline_date, commercial_responsible, meeting_date`), filtros `eq` + `ilike` no Supabase, `order('created_at', desc)`, `range(...)`, `count: 'exact'`, `placeholderData: keepPreviousData`.
3. Aba Clientes:
   - Substituir `select("*")` por colunas explícitas (`id, name, email, phone, document, type, notes, business_unit_id, active`).
   - Paginar 50/pág; busca `ilike` server-side por `name`/`email`/`document`.
   - Manter `clientsById` (lookup) com query separada `['clients','lookup']` com colunas mínimas (`id, name, business_unit_id, type`) carregando até 5000 — necessário para resolver nomes na tabela de devis sem N+1.
4. `devis-financial-entries` e `devis-services` continuam (são lookups agregados para badges); mantém colunas explícitas como já estão.
5. `LoadingState`/`EmptyState`/`ErrorState` na tabela de devis e na aba Clientes; `<Pagination/>` no rodapé de ambas.

### Passo 2 — Financeiro
1. Query principal `['financial-entries', {page, competence, businessUnit, bank, type, status, origin, realized, search}]`:
   - Colunas explícitas (substituir `select("*")` pela lista do tipo `Entry`).
   - Todos os filtros via `eq`/`ilike` no Supabase; `range`+`count:'exact'`; `order entry_date desc`; `placeholderData: keepPreviousData`.
   - "Origem" e "Realizado/Previsto" mapeados para condições SQL:
     - origem `transferência` → `eq('entry_type','transferencia')`
     - origem `ofx` → `in('source_type', ['ofx','extrato'])`
     - origem `comercial` → `not('document_reference','is',null)` + `neq('entry_type','transferencia')`
     - origem `manual` → `eq('source_type','manual')` + `is('document_reference', null)`
     - realizado → `neq('conciliation_status','pendente')`; previsto → `eq('conciliation_status','pendente')`.
   - 50/pág.
2. **Métricas/Analítico (gargalo real):** criar (nova migration) duas RPCs no banco para não depender dos 500 registros em memória:
   - `financeiro_summary(_competence, _business_unit, _search, _bank, _type, _status, _origin, _realized) returns jsonb` → totais (in/out/transferências/previstoIn/saldoFinal) **respeitando os mesmos filtros**.
   - `financeiro_analitico(... mesmos filtros)` → agregado por `competence_month` (in/out).
   - Useremos `useQuery` separadas que chamam `supabase.rpc(...)` com a mesma queryKey dos filtros. Sem cálculo no frontend.
3. Aba Fluxo (agrupamento por banco) e aba Analítico passam a usar a RPC ou paginação por banco — neste sprint, mantemos o agrupamento da página atual (já filtrado/paginado) com aviso de "visível na página".
4. `bank-accounts` mantém como está (lista pequena, já tem colunas explícitas).

### Passo 3 — Conciliação
1. **Não quebrar o matching:** Separar "lista exibida" de "universo para matching".
   - `bank-statements-display` (paginada 50/pág, colunas explícitas: `id, transaction_date, description, amount, direction, conciliation_status, bank_account_id, document_number`, filtro `ilike` no `description` server-side, ordem por data desc, `count:'exact'`). Usada na tabela.
   - `financial-entries-conciliation` (paginada 50/pág, colunas explícitas) usada na tabela de FE.
2. Matching automático (`suggestMatches`): mover para o banco como RPC `suggest_conciliation_matches()` que faz o cross-join com janela de 5 dias e tolerância de centavos, inserindo direto em `conciliation_matches`. Frontend só dispara a RPC. Evita carregar tudo no cliente.
3. `autoSuggest` em memória (usado no layout "paired"): substituir por uma query pontual `select(...).gte/lte/eq(amount/date/direction)` por linha visível — chamada via `useQueries` em cima das `pageStatements`. Mantém UX.
4. `conciliation-matches`: já é pequena por natureza, mas adiciona colunas explícitas (`id, bank_statement_entry_id, financial_entry_id, status, match_score, match_type, created_at`) e `.in('bank_statement_entry_id', visibleIds)` para trazer só os matches dos extratos visíveis.
5. `LoadingState`/`EmptyState`/`ErrorState` + `<Pagination/>` nas duas tabelas.

## Arquivos impactados
- `src/routes/_authenticated/comercial.tsx`
- `src/routes/_authenticated/financeiro.tsx`
- `src/routes/_authenticated/conciliacao.tsx`
- Nova migration: `supabase/migrations/<timestamp>_financeiro_e_conciliacao_rpcs.sql` com:
  - `financeiro_summary(...)` (security definer, stable)
  - `financeiro_analitico(...)` (stable)
  - `suggest_conciliation_matches()` (security definer)

## Riscos e mitigação
- **Comercial — indicadores/Kanban:** Kanban precisa de todos os devis; manter uma query separada leve (`select` colunas mínimas, `range(0, 4999)`) só para Kanban+indicadores. Quando a base ultrapassar 5k, migrar Kanban para "carregar por coluna/status".
- **Financeiro — totais:** depender das novas RPCs com os mesmos filtros. Testar igualdade dos números antes/depois com dataset atual.
- **Conciliação — matching:** mover para SQL evita carregar tudo no cliente; o algoritmo atual é simples (amount ± 0.01, data ± 5 dias) → traduz 1:1 em SQL.
- **Tipos TS:** ao trocar `select("*")` por colunas, derivar tipos de `Database['public']['Tables'][T]['Row']` com `Pick<...>` para evitar quebras.
- **Realtime no Comercial:** manter as 3 subscriptions; invalidam queries paginadas (re-fetch da página atual) sem efeito colateral.

## Ordem de aplicação
1. Comercial (passo 1) → reportar.
2. Financeiro (passo 2 — incluindo a migration das RPCs) → reportar.
3. Conciliação (passo 3 — incluindo a RPC de matching) → reportar.

Sem mudanças de RLS, matriz de papéis, regras de negócio ou layout.

Posso iniciar?
