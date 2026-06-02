/**
 * scripts/seed-data.ts
 *
 * Copia dados de TODAS as 18 tabelas public.* do projeto antigo
 * (phmqxmwaoonbibgvbumq) para o NOVO (uxwdzcjhrhlugrjgpkcr).
 *
 * Pré-requisitos:
 *   1. supabase/migrations/0001_schema.sql aplicado no destino
 *   2. scripts/migrate-users.ts executado → scripts/user-id-map.json existe
 *   3. bun add @supabase/supabase-js dotenv
 *   4. scripts/.env com:
 *        OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY,
 *        NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   bun run scripts/seed-data.ts --dry-run    # apenas exporta ./export/*.json
 *   bun run scripts/seed-data.ts              # exporta E insere no destino
 *
 * IMPORTANTE — triggers durante o seed:
 *   Não conseguimos rodar `SET session_replication_role = replica` via REST.
 *   Solução: o seed envia `devis_number`, `down_payment_amount` e `status`
 *   ORIGINAIS no INSERT. Os triggers `generate_devis_number` e
 *   `calc_devis_down_payment` respeitam valores já preenchidos (no-op).
 *   O trigger `devis_status_progression` SOBRESCREVE status para estados
 *   pré-envio; para devis em estados pós-envio (enviada_ao_cliente,
 *   aceita, etc.) o trigger é no-op (early return). Para os 12 devis
 *   atuais isso é seguro — confirme contagem por status antes.
 *
 *   Os triggers `trg_devis_accepted_*` (cria service + financial_entry)
 *   disparam em INSERT quando accepted_at IS NOT NULL. Como já vamos
 *   inserir services e financial_entries explicitamente DEPOIS dos devis,
 *   há risco de duplicar. Mitigação: a função tem proteção idempotente
 *   (verifica EXISTS), mas para garantia total, recomenda-se desabilitar
 *   esses 2 triggers via SQL antes do seed:
 *
 *     ALTER TABLE public.devis DISABLE TRIGGER trg_devis_accepted_create_service;
 *     ALTER TABLE public.devis DISABLE TRIGGER trg_devis_accepted_create_charge;
 *     -- ... rodar seed ...
 *     ALTER TABLE public.devis ENABLE TRIGGER trg_devis_accepted_create_service;
 *     ALTER TABLE public.devis ENABLE TRIGGER trg_devis_accepted_create_charge;
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { config } from "dotenv";

config({ path: new URL("./.env", import.meta.url).pathname });

const DRY_RUN = process.argv.includes("--dry-run");

const {
  OLD_SUPABASE_URL,
  OLD_SUPABASE_SERVICE_ROLE_KEY,
  NEW_SUPABASE_URL,
  NEW_SUPABASE_SERVICE_ROLE_KEY,
} = process.env as Record<string, string>;

for (const k of [
  "OLD_SUPABASE_URL",
  "OLD_SUPABASE_SERVICE_ROLE_KEY",
  "NEW_SUPABASE_URL",
  "NEW_SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const newDb = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- user-id remap ----------
const mapPath = new URL("./user-id-map.json", import.meta.url).pathname;
if (!existsSync(mapPath) && !DRY_RUN) {
  console.error(`Faltando ${mapPath}. Rode primeiro: bun run scripts/migrate-users.ts`);
  process.exit(1);
}
const userIdMap: Record<string, string> = existsSync(mapPath)
  ? JSON.parse(readFileSync(mapPath, "utf8"))
  : {};

function remapUserId(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return userIdMap[v] ?? v;
}

// ---------- ordem de seed (respeita FKs) ----------
type TableSpec = {
  name: string;
  userIdCols?: string[];     // colunas que apontam para auth.users(id)
  orderBy?: string;          // coluna para paginação estável
  upsertOn?: string;         // se setado, usa upsert com onConflict nessa coluna
};

const TABLES: TableSpec[] = [
  { name: "business_units",          orderBy: "created_at" },
  { name: "bank_accounts",           orderBy: "created_at" },
  { name: "clients",                 orderBy: "created_at" },
  { name: "import_batches",          orderBy: "imported_at", userIdCols: ["imported_by"] },
  { name: "bank_statement_entries",  orderBy: "created_at" },
  { name: "financial_entries",       orderBy: "created_at",  userIdCols: ["user_id"] },
  { name: "conciliation_matches",    orderBy: "created_at",  userIdCols: ["confirmed_by"] },
  { name: "devis",                   orderBy: "created_at",
    userIdCols: ["created_by", "commercial_responsible", "validated_by"] },
  { name: "services",                orderBy: "created_at",  userIdCols: ["assigned_to"] },
  { name: "system_settings",         orderBy: "created_at",  userIdCols: ["updated_by"] },
  { name: "api_keys",                orderBy: "created_at",  userIdCols: ["created_by"] },
  { name: "audit_logs",              orderBy: "created_at",  userIdCols: ["user_id"] },
  { name: "email_send_log",          orderBy: "created_at" },
  { name: "email_send_state",        orderBy: "id" },
  { name: "email_unsubscribe_tokens", orderBy: "created_at" },
  { name: "suppressed_emails",       orderBy: "created_at" },
  // profiles: o trigger handle_new_user (em auth.users) cria uma linha vazia
  // assim que migrate-users.ts insere o usuário no destino. Para evitar
  // colisão em UNIQUE(profiles.user_id) durante o seed, usamos upsert com
  // onConflict=user_id — os dados originais sobrescrevem o stub do trigger.
  { name: "profiles",                orderBy: "created_at",  userIdCols: ["user_id"], upsertOn: "user_id" },
  { name: "user_roles",              orderBy: "id",          userIdCols: ["user_id"] },
];

const PAGE_SIZE = 500;

async function fetchAll(table: string, orderBy?: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = oldDb.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (orderBy) q = q.order(orderBy, { ascending: true, nullsFirst: true });
    const { data, error } = await q;
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function remapRow(row: Record<string, unknown>, cols?: string[]): Record<string, unknown> {
  if (!cols?.length) return row;
  const out = { ...row };
  for (const c of cols) {
    if (c in out) out[c] = remapUserId(out[c]);
  }
  return out;
}

async function insertChunked(
  table: string,
  rows: Record<string, unknown>[],
  upsertOn?: string,
) {
  if (rows.length === 0) return;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = upsertOn
      ? await newDb.from(table).upsert(chunk, { onConflict: upsertOn })
      : await newDb.from(table).insert(chunk);
    if (error) {
      console.error(`  ✗ ${upsertOn ? "upsert" : "insert"} ${table} chunk ${i}: ${error.message}`);
      // grava o chunk problemático para inspeção
      writeFileSync(`./export/_failed_${table}_${i}.json`, JSON.stringify(chunk, null, 2));
      throw error;
    }
  }
}

async function main() {
  const exportDir = "./export";
  if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true });

  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (apenas export)" : "EXPORT + INSERT no destino"}\n`);

  for (const spec of TABLES) {
    process.stdout.write(`→ ${spec.name.padEnd(28)} `);
    const rows = await fetchAll(spec.name, spec.orderBy);
    const remapped = rows.map((r) => remapRow(r, spec.userIdCols));

    writeFileSync(
      `${exportDir}/${spec.name}.json`,
      JSON.stringify(remapped, null, 2),
    );
    process.stdout.write(`fetched=${rows.length}`);

    if (!DRY_RUN) {
      await insertChunked(spec.name, remapped, spec.upsertOn);
      process.stdout.write(`  ${spec.upsertOn ? "upserted" : "inserted"}=${remapped.length}`);
    }
    process.stdout.write("\n");
  }

  console.log("\n✓ concluído");
  if (DRY_RUN) console.log(`  arquivos em ${exportDir}/`);
  if (!DRY_RUN) {
    console.log("\nLEMBRETE: verifique se desabilitou os triggers:");
    console.log("  trg_devis_accepted_create_service / trg_devis_accepted_create_charge");
    console.log("  e reabilite-os após a validação.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
