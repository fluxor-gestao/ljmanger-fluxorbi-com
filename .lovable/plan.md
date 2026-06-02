# Geração dos artefatos de migração (sem aplicar)

Apenas criar 4 arquivos no repositório. Nada será aplicado contra `phmqxmwaoonbibgvbumq` nem contra `uxwdzcjhrhlugrjgpkcr`. Storage segue pausado.

## Arquivos a criar

### 1. `supabase/migrations/0001_schema.sql` (~40 KB, ~1.300 linhas)
Ordem rígida:
1. `CREATE EXTENSION IF NOT EXISTS pgcrypto, "uuid-ossp", pg_net, pgmq, pg_cron;`
2. `CREATE SCHEMA IF NOT EXISTS app_private;`
3. **9 enums** em `public`: `app_role` (7 valores), `devis_status` (16 valores), `service_status`, `conciliation_status`, `entry_type`, `source_type`, `import_status`, `match_status`, `match_type`.
4. **18 tabelas** `public.*` com todos defaults/NOT NULL extraídos do schema atual. FKs para `auth.users(id)` marcadas `NOT VALID` quando assim estavam (`api_keys.created_by`, `devis.commercial_responsible`, `devis.validated_by`).
5. **~30 índices** não-pkey (lista completa de `pg_indexes`), incluindo parciais como `idx_email_send_log_message_sent_unique` e `idx_api_keys_hash WHERE revoked_at IS NULL`.
6. **GRANTs** por tabela:
   - User-facing (`clients, devis, services, financial_entries, bank_*, conciliation_matches, import_batches, business_units, system_settings, profiles, user_roles, audit_logs, api_keys`): `GRANT SELECT,INSERT,UPDATE,DELETE … TO authenticated; GRANT ALL … TO service_role;`
   - Service-role-only (`email_send_log, email_send_state, email_unsubscribe_tokens, suppressed_emails`): `GRANT ALL … TO service_role;`
7. **Funções** em ordem de dependência: `update_updated_at_column`, `public.has_role`, `app_private.has_role`, `handle_new_user`, `next_devis_number`, `generate_devis_number`, `calc_devis_down_payment`, `fx_recompute_total_brl`, `devis_status_progression`, `devis_accepted_create_service`, `create_devis_initial_charge`, `trg_devis_accepted_charge`, `auto_advance_sent_devis`, `validate_api_key`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `bi_kpis_comercial`, `bi_kpis_financeiro`, `bi_kpis_operacao`, `financeiro_summary`, `financeiro_analitico`. Todos com `SECURITY DEFINER` e `SET search_path` idênticos ao original.
8. **15 triggers** literais (14 em `public.*` + `on_auth_user_created` em `auth.users`).
9. `ALTER TABLE … ENABLE ROW LEVEL SECURITY` para as 18 tabelas.
10. **~20 RLS policies** (cópia literal de `pg_policies`), incluindo a policy `RESTRICTIVE` em `user_roles`.

### 2. `supabase/migrations/0002_storage.sql` (~2 KB)
- `INSERT INTO storage.buckets(id,name,public) VALUES ('devis-pdfs','devis-pdfs',false) ON CONFLICT DO NOTHING;`
- 4 policies em `storage.objects` (SELECT/INSERT/UPDATE/DELETE para admin/comercial via `public.has_role`).
- **Não inclui** cópia de arquivos — script separado virá quando a `SERVICE_ROLE_KEY` antiga for confirmada.

### 3. `scripts/seed-data.ts` (~12 KB)
- Node + `@supabase/supabase-js`.
- Lê env: `OLD_SUPABASE_URL`, `OLD_SUPABASE_SERVICE_ROLE_KEY`, `NEW_SUPABASE_URL`, `NEW_SUPABASE_SERVICE_ROLE_KEY`, `USER_ID_MAP_JSON` (gerado pelo `migrate-users.ts`).
- Para cada tabela, faz `select * order by created_at` paginado em chunks de 500 (margem; volumes atuais cabem em 1 página).
- Remapeia colunas que referenciam `auth.users(id)` usando o `USER_ID_MAP_JSON`: `audit_logs.user_id`, `api_keys.created_by`, `devis.{created_by,commercial_responsible,validated_by}`, `services.assigned_to`, `import_batches.imported_by`, `financial_entries.user_id`, `conciliation_matches.confirmed_by`, `profiles.user_id`, `user_roles.user_id`, `system_settings.updated_by`.
- Antes do insert no destino: `SET session_replication_role = replica;` (via RPC ou `pg-promise`) para suprimir triggers (`generate_devis_number`, `calc_devis_down_payment`, `devis_status_progression`, `fx_recompute_total_brl`, `trg_devis_accepted_*`) e preservar `devis_number`/`status`/`down_payment_amount` originais. Restaura ao final.
- Ordem de inserção respeitando FKs:
  `business_units → bank_accounts → clients → import_batches → bank_statement_entries → financial_entries → conciliation_matches → devis → services → system_settings → api_keys → audit_logs → email_send_log → email_send_state → email_unsubscribe_tokens → suppressed_emails → profiles → user_roles`.
- Dry-run mode (`--dry-run`) que apenas exporta para `./export/*.json`.

### 4. `scripts/migrate-users.ts` (~5 KB)
- Lê 2 e-mails do JSON exportado (`admin@admin.com`, `gestao@fluxorbi.com`).
- Para cada um: `supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name } })` no destino.
- Monta `user-id-map.json` (`{ "old-uuid": "new-uuid" }`) — input do `seed-data.ts`.
- Para cada usuário criado: `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })` e imprime o link no stdout (envio por Resend fica como TODO opcional).
- **Não toca** em `auth.identities` (Google OAuth se religa automaticamente no primeiro login com mesmo e-mail confirmado).

## Dependências necessárias (para uso futuro dos scripts)

- Node 20+, executados **fora** do Lovable (CLI local do usuário).
- `npm i @supabase/supabase-js dotenv` em um diretório `scripts/` isolado (ou usar `bun run`).
- Variáveis de ambiente em `scripts/.env` (não commitar):
  ```
  OLD_SUPABASE_URL=https://phmqxmwaoonbibgvbumq.supabase.co
  OLD_SUPABASE_SERVICE_ROLE_KEY=<aguardando confirmação>
  NEW_SUPABASE_URL=https://uxwdzcjhrhlugrjgpkcr.supabase.co
  NEW_SUPABASE_SERVICE_ROLE_KEY=<do dashboard do novo projeto>
  ```

## Checklist de execução futura (não agora)

```
PRÉ-REQUISITOS
[ ] No projeto NOVO (uxwdzcjhrhlugrjgpkcr):
    [ ] Habilitar extensões: pgcrypto, uuid-ossp, pg_net, pgmq, pg_cron
    [ ] Auth → habilitar e-mail/senha; configurar Google OAuth (Client ID/Secret)
    [ ] Site URL e Redirect URLs apontando para o domínio final
    [ ] Anotar SERVICE_ROLE_KEY
[ ] Obter SERVICE_ROLE_KEY do projeto ANTIGO (pendência atual)

APLICAÇÃO (ordem)
[ ] psql NOVO < supabase/migrations/0001_schema.sql
[ ] psql NOVO < supabase/migrations/0002_storage.sql
[ ] supabase--linter NOVO → resolver warnings
[ ] node scripts/migrate-users.ts → gera user-id-map.json
[ ] node scripts/seed-data.ts --dry-run → valida exports
[ ] node scripts/seed-data.ts → popula NOVO
[ ] (pendente) scripts/migrate-storage.ts → copia PDFs do bucket
[ ] Recriar 2 cron jobs (devis-auto-advance-sent + process-email-queue
    com URL/JWT novos do Lovable e secret email_queue_service_role_key no vault)
[ ] Disparar manualmente recovery e-mails aos 2 usuários

VALIDAÇÃO (smoke tests)
[ ] count(*) por tabela bate com snapshot do antigo
[ ] enum devis_status com 16 valores
[ ] login + criação de devis + aceite + KPIs OK

CUTOVER (somente com autorização explícita)
[ ] Disable Lovable Cloud no projeto
[ ] Conectar Supabase manual ao uxwdzcjhrhlugrjgpkcr
[ ] Redeploy edge functions
[ ] Recolocar secrets (OPENAI, RESEND, LOVABLE_API_KEY)
[ ] Atualizar webhooks externos
```

## Resumo entregável

| Arquivo | Tamanho aprox. | Status |
|---|---|---|
| `supabase/migrations/0001_schema.sql` | ~40 KB | gerar |
| `supabase/migrations/0002_storage.sql` | ~2 KB | gerar (sem arquivos) |
| `scripts/seed-data.ts` | ~12 KB | gerar |
| `scripts/migrate-users.ts` | ~5 KB | gerar |
| `scripts/migrate-storage.ts` | — | **pausado** até SERVICE_ROLE_KEY |

Aprove este plano para eu materializar os 4 arquivos. Nenhum deles é executado pelo Lovable nem por nenhum runtime do projeto — ficam parados no repo aguardando você rodar manualmente contra o destino.
