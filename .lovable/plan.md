## Finalizar importação dos dados restantes

Continuar a migração do `migration_bundle.sql` com as tabelas que faltam, em ordem de dependência:

1. **`import_batches`** (6 registros) — precisa vir antes de `financial_entries` (que referencia via `import_batch_id`).
2. **`devis`** (3 registros) — usar `session_replication_role = 'replica'` para não disparar `generate_devis_number` nem `calc_devis_down_payment` e preservar valores originais.
3. **`services`** (3 registros) — referenciam `devis_id` e `client_id` (já importados).
4. **`financial_entries`** (5 registros) — referenciam `import_batches` e `bank_accounts`.
5. **`audit_logs`** (6 registros) — independente, último.

### Validação
Após cada bloco, rodar `SELECT count(*)` para confirmar contagens batendo com o esperado (3/3/3/5/6/6). Se algum INSERT falhar por enum/coluna, ajusto e re-rodo (os INSERTs são `ON CONFLICT DO NOTHING`, então é seguro).

### Detalhes técnicos
- Tudo dentro de `BEGIN; SET LOCAL session_replication_role = 'replica'; ... COMMIT;` para desabilitar triggers durante o import e preservar UUIDs, `devis_number`, `down_payment_amount`, `created_at` originais.
- Não toco em `auth.*` (já feito na parte 1).
- Sem mudanças de schema — apenas dados.

Aprovar para executar?
