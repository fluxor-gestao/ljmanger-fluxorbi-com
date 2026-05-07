## Objetivo

Aplicar mitigações **(a) avisar quando truncar** e **(b) exigir `from`/`to` em `?all=true`**, e já preparar o terreno para que os KPIs migrem de `fetchAll` para **agregação no Postgres** (RPC / view materializada), sem reescrever o BI depois.

---

## 1. `src/lib/bi-auth.server.ts`

- `fetchAll<T>` passa a retornar `{ data, total, truncated, error }` — `truncated = true` quando atinge `MAX_ALL_ROWS` (200k) e ainda havia chunk cheio.
- `validateBiRequest`: quando `all=true`, **exigir** `from` E `to` (formato `YYYY-MM-DD`). Sem isso → `400` com mensagem clara.
- Validar também janela máxima (ex.: `to - from <= 366 dias`) → força BI a paginar por janelas grandes mas não absurdas.
- Adicionar parâmetro opcional `MAX_WINDOW_DAYS = 366` exposto como const exportada.

## 2. Endpoints de dados brutos (`bi-comercial`, `bi-financeiro`, `bi-operacao`)

- Propagar `truncated` no `meta`:
  ```json
  { "data": [...], "meta": { "total": 200000, "all": true, "truncated": true, "warning": "Resultado truncado em 200000 linhas. Reduza o intervalo from/to." } }
  ```
- Sem mudanças no caminho paginado normal.

## 3. KPIs — preparar migração para agregação no DB

Criar **funções SQL `SECURITY DEFINER`** que retornam KPIs já agregados (uma query, sem trafegar linhas):

- `bi_kpis_comercial(_from date, _to date)` → retorna jsonb com `total_devis`, `accepted`, `rejected`, `conversion_rate`, `total_amount`, `accepted_amount`, `avg_ticket`, `by_status`.
- `bi_kpis_financeiro(_from date, _to date)` → `total_in`, `total_out`, `net`, `entries_count`, `by_month` (via `date_trunc('month', entry_date)` + `group by`).
- `bi_kpis_operacao(_from date, _to date)` → `total_services`, `completed`, `delayed`, `in_progress`, `by_status`.

Os 3 endpoints de KPIs passam a chamar `supabaseAdmin.rpc('bi_kpis_xxx', { _from, _to })` em vez de `fetchAll`. Resposta fica idêntica ao formato atual → BI não quebra.

Vantagens:
- KPI em **1 request SQL**, não 200 chunks.
- Sem risco de truncamento silencioso.
- Funciona sem limite de linhas, em milissegundos.
- `from`/`to` viram opcionais nesses endpoints (o agregado já é barato).

## 4. `admin_.api-keys.tsx`

- Documentar:
  - `?all=true` requer `from` e `to` (janela máx 366 dias).
  - Quando `meta.truncated === true`, refazer o request com janela menor.
  - KPIs agora rodam direto no banco — sempre exatos, sem custo de paginação.
- Atualizar exemplos `curl`.

## 5. Migration SQL

Uma migration cria as 3 funções RPC `bi_kpis_*` no schema `public`, com `GRANT EXECUTE` para `service_role` (já é o que `supabaseAdmin` usa).

---

## Arquivos tocados

- `src/lib/bi-auth.server.ts` (truncated + validação from/to)
- `src/routes/api/public/bi-comercial.ts` (meta.truncated)
- `src/routes/api/public/bi-financeiro.ts` (meta.truncated)
- `src/routes/api/public/bi-operacao.ts` (meta.truncated)
- `src/routes/api/public/bi-kpis-comercial.ts` (RPC)
- `src/routes/api/public/bi-kpis-financeiro.ts` (RPC)
- `src/routes/api/public/bi-kpis-operacao.ts` (RPC)
- `src/routes/_authenticated/admin_.api-keys.tsx` (docs)
- migration SQL com as 3 funções RPC

## Fora de escopo (futuro)

- View materializada com refresh agendado (só se KPIs ficarem lentos mesmo com RPC).
- Streaming NDJSON / cursor pagination para `?all=true` muito grandes.
