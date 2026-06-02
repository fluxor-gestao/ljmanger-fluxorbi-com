## Ajustes em `scripts/seed-data.ts` (sem execução)

### 1. Verificação dos nomes de trigger
Confiri em `migrations-export/0001_schema.sql` (linhas 606-607):

```
CREATE TRIGGER trg_devis_accepted_create_service ... EXECUTE FUNCTION public.devis_accepted_create_service();
CREATE TRIGGER trg_devis_accepted_create_charge  ... EXECUTE FUNCTION public.trg_devis_accepted_charge();
```

- **Nome do trigger** (objeto que vai em `ALTER TABLE ... DISABLE TRIGGER`): `trg_devis_accepted_create_charge` ✅
- `trg_devis_accepted_charge` é apenas o nome da **função** chamada pelo trigger — não usar em DISABLE/ENABLE.

→ Os comandos já presentes no comentário de `seed-data.ts` (linhas 36-40) e no lembrete final (linha 192) **já estão corretos**. Nenhum ajuste necessário neste ponto. Vou apenas reforçar o esclarecimento num comentário curto para evitar a confusão futura.

### 2. Profiles com ON CONFLICT
Hoje `seed-data.ts` faz `newDb.from("profiles").insert(chunk)`. Como o trigger `handle_new_user` insere um profile vazio assim que `migrate-users.ts` cria cada usuário em `auth.users`, o seed atual falharia em UNIQUE (`profiles.user_id`).

**Mudança proposta**: usar upsert da PostgREST com `onConflict: "user_id"` para a tabela `profiles`. Mantém-se `insert` para todas as outras 17 tabelas (sem regressão).

#### Diff conceitual em `scripts/seed-data.ts`

```diff
 type TableSpec = {
   name: string;
   userIdCols?: string[];
   orderBy?: string;
+  upsertOn?: string; // coluna(s) para ON CONFLICT
 };

 const TABLES: TableSpec[] = [
   ...
-  { name: "profiles",   orderBy: "created_at",  userIdCols: ["user_id"] },
+  { name: "profiles",   orderBy: "created_at",  userIdCols: ["user_id"], upsertOn: "user_id" },
   ...
 ];
```

```diff
-async function insertChunked(table: string, rows: Record<string, unknown>[]) {
+async function insertChunked(
+  table: string,
+  rows: Record<string, unknown>[],
+  upsertOn?: string,
+) {
   if (rows.length === 0) return;
   const CHUNK = 200;
   for (let i = 0; i < rows.length; i += CHUNK) {
     const chunk = rows.slice(i, i + CHUNK);
-    const { error } = await newDb.from(table).insert(chunk);
+    const { error } = upsertOn
+      ? await newDb.from(table).upsert(chunk, { onConflict: upsertOn })
+      : await newDb.from(table).insert(chunk);
     if (error) { ... }
   }
 }
```

```diff
-    if (!DRY_RUN) {
-      await insertChunked(spec.name, remapped);
-      process.stdout.write(`  inserted=${remapped.length}`);
-    }
+    if (!DRY_RUN) {
+      await insertChunked(spec.name, remapped, spec.upsertOn);
+      process.stdout.write(
+        `  ${spec.upsertOn ? "upserted" : "inserted"}=${remapped.length}`,
+      );
+    }
```

E um comentário curto perto dos lembretes de trigger, explicitando:
- O **nome do trigger** é `trg_devis_accepted_create_charge` (com `create`).
- `trg_devis_accepted_charge` (sem `create`) é o nome da **função** — não usar em DISABLE/ENABLE.

### 3. O que NÃO será feito
- Não executar nada (sem `bun run`, sem `psql`).
- Não aplicar migrations.
- Não tocar no Supabase antigo nem no novo.
- Não tocar em Storage (continua pausado aguardando `OLD_SERVICE_ROLE_KEY`).
- Não alterar `migrations-export/*.sql`, `scripts/migrate-users.ts`, ou qualquer outro arquivo.

### Arquivos alterados após aprovação
- `scripts/seed-data.ts` apenas (≈10 linhas de mudança líquida + 3 linhas de comentário).

### Entrega final
Após aplicar, devolvo o diff exato (linhas antes/depois) e confirmo que nenhum outro arquivo foi tocado.