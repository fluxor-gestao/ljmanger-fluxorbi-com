# Sprint 2 — Performance e consultas server-side

## Diagnóstico

### `select("*")` encontrados (13 ocorrências)
- `operacao.tsx:41` — services
- `financeiro.tsx:113` — financial_entries
- `conciliacao.tsx:48,57,66` — bank_statement_entries, financial_entries, conciliation_matches
- `comercial.tsx:101,110` — clients, devis
- `comercial_.devis.$id.tsx:48,57` — devis (single), clients
- `admin.tsx:183,192,203` — profiles, user_roles, audit_logs
- `admin_.api-keys.tsx:76` — api_keys

### Telas sem paginação server-side
| Tela | Query atual | Risco |
|---|---|---|
| Comercial | clients + devis sem limit | Alto — cresce rápido |
| Financeiro | financial_entries sem limit | Alto — milhares/mês |
| Conciliação | 3 queries com `.limit(200)` fixo | Médio — corta dados |
| Operação | services sem limit | Médio |
| Admin (audit_logs) | `.limit(50)` fixo, sem paginar | Médio |
| Admin (profiles/roles) | sem paginação | Baixo (~25 users) |

### Consultas duplicadas
- `clients` carregado em `comercial.tsx` e em `comercial_.devis.$id.tsx` — pode reusar via queryKey compartilhada.
- `profiles` + `user_roles` cruzados client-side em admin.

### Filtros que rodam no frontend (devem ir pro banco)
- Comercial: busca por título/cliente, filtro por status/business_unit — hoje filtra após `select("*")`.
- Financeiro: filtros de data, business_unit, tipo, conciliation_status.
- Conciliação: status pendente já está no SQL, mas busca textual é client-side.

## Plano de execução (3 blocos, aplicados separadamente com aprovação entre cada um)

### Bloco 1 — Fundação (hooks + tipos)
1. Criar `src/lib/pagination.ts`: tipo `PageState { page, pageSize, total }` + helper `rangeFor(page, pageSize)`.
2. Criar `src/hooks/usePaginatedQuery.ts`: wrapper sobre `useQuery` que aceita `{ table, columns, filters, order, page, pageSize }` e devolve `{ rows, total, isLoading, error, refetch }` usando `.select(columns, { count: 'exact' }).range(...)`.
3. Criar `src/components/DataStates.tsx`: `<LoadingState/>`, `<EmptyState/>`, `<ErrorState onRetry/>` reutilizáveis.
4. Criar `src/components/Pagination.tsx`: controles "Anterior/Próxima" + indicador "X–Y de N".

Sem mudança visual nas telas ainda.

### Bloco 2 — Comercial, Financeiro, Conciliação
Aplicar nas 3 telas críticas:
- **Comercial** (`comercial.tsx`):
  - `devis`: paginar (20/pág), colunas explícitas (`id, devis_number, title, status, total_amount, business_unit, client_id, created_at, accepted_at, sent_at, deadline_date`), filtros server-side (status, business_unit, busca por título/devis_number via `ilike`), ordenação por `created_at desc` no banco.
  - `clients`: trocar `select("*")` por `id, name, business_unit_id, type` (apenas o que o select de devis usa); paginar a aba Clientes (50/pág).
- **Financeiro** (`financeiro.tsx`): paginar `financial_entries` (50/pág), colunas explícitas, filtros de data/business_unit/entry_type/conciliation_status server-side, ordenação `entry_date desc`.
- **Conciliação** (`conciliacao.tsx`): manter limites mas trocar para paginação real, colunas explícitas nas 3 queries, busca textual via `ilike` no banco.

Adicionar Loading/Empty/Error states + botão "Tentar novamente".

### Bloco 3 — Operação, Clientes, Serviços, Admin/Auditoria
- **Operação** (`operacao.tsx`): paginar services, colunas explícitas, filtros por status/sector.
- **Clientes** (aba dentro de comercial): já coberta no Bloco 2.
- **Admin** (`admin.tsx`):
  - `audit_logs`: paginar (50/pág) com filtro por entity_type/action/data.
  - `profiles`, `user_roles`, `api_keys`: colunas explícitas; paginação leve (50/pág) só se necessário.
- **Devis detalhe** (`comercial_.devis.$id.tsx`): colunas explícitas em devis e clients; reuso da query de clients via queryKey compartilhada (`['clients','lookup']`).

## Detalhes técnicos

**Paginação Supabase:**
```ts
const from = page * pageSize;
const to = from + pageSize - 1;
const { data, count, error } = await supabase
  .from('devis')
  .select('id, devis_number, ...', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to);
```

**queryKey inclui filtros/página** → cache automático por combinação, sem refetch indevido.

**Sem mudanças em:** RLS, regras de negócio, layout geral, matriz de papéis, BI (já usa funções agregadas).

## Riscos e mitigação
- Quebra de tipos TS ao trocar `select("*")` por colunas → tipos derivados de `Database['public']['Tables'][T]['Row']`, escolher apenas campos efetivamente lidos no JSX (verifico cada uso antes).
- Filtros antes carregados em memória que esperavam todos os registros → mantenho a UX (mesmos filtros), só movo a lógica para a query.
- Conciliação tem matching automático que percorre as 3 listas — verifico se depende de carregar tudo; se sim, isolo a heurística de matching numa query própria (sem paginação) e paginei apenas o display.

## Ordem proposta
Aprovar este plano → executo **Bloco 1** (fundação, sem impacto visual) → reporto → **Bloco 2** (3 telas críticas) → reporto → **Bloco 3** (restantes).

Posso começar?
