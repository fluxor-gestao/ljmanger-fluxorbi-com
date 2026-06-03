/**
 * scripts/seed-data.ts
 *
 * Importa dados das 18 tabelas public.* para o NOVO Supabase a partir
 * de snapshots JSON locais em ./export/<tabela>.json.
 *
 * NÃO depende mais do projeto antigo nem de scripts/user-id-map.json.
 * Os user_id antigos são remapeados pelo email (lendo profiles.json
 * + auth.admin.listUsers() no novo Supabase). Tudo que não casar por
 * email é remapeado para o usuário admin (SEED_ADMIN_EMAIL) como
 * fallback.
 *
 * Pré-requisitos:
 *   1. supabase/migrations/0001_schema.sql aplicado no destino.
 *   2. Usuários criados manualmente no Auth do novo Supabase:
 *        - SEED_ADMIN_EMAIL  (ex.: admin@admin.com)
 *        - SEED_GESTAO_EMAIL (ex.: gestao@fluxorbi.com)
 *      (E qualquer outro usuário cujo email apareça em profiles.json
 *       que você queira preservar como autor — opcional.)
 *   3. Snapshots JSON do projeto antigo em ./export/<tabela>.json
 *      (mesmo formato exportado pelo dry-run da versão anterior:
 *       array de objetos, um por linha, chaves = nomes de coluna).
 *   4. bun add @supabase/supabase-js dotenv
 *   5. scripts/.env com:
 *        NEW_SUPABASE_URL
 *        NEW_SUPABASE_SERVICE_ROLE_KEY
 *        SEED_ADMIN_EMAIL=admin@admin.com
 *        SEED_GESTAO_EMAIL=gestao@fluxorbi.com
 *        SEED_EXPORT_DIR=./export      # opcional, default ./export
 *
 * Uso:
 *   bun run scripts/seed-data.ts --dry-run    # só valida leitura e mapping
 *   bun run scripts/seed-data.ts              # insere/upserta no destino
 *
 * Triggers em public.devis (recomendado desabilitar antes do seed):
 *     ALTER TABLE public.devis DISABLE TRIGGER trg_devis_accepted_create_service;
 *     ALTER TABLE public.devis DISABLE TRIGGER trg_devis_accepted_create_charge;
 *     -- rodar o seed --
 *     ALTER TABLE public.devis ENABLE TRIGGER trg_devis_accepted_create_service;
 *     ALTER TABLE public.devis ENABLE TRIGGER trg_devis_accepted_create_charge;
 *
 *   Atenção: trg_devis_accepted_charge (sem "create") é o nome da FUNÇÃO
 *   chamada pelo trigger trg_devis_accepted_create_charge — não usar em
 *   DISABLE TRIGGER.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { config } from "dotenv";

config({ path: new URL("./.env", import.meta.url).pathname });

const DRY_RUN = process.argv.includes("--dry-run");

const {
  NEW_SUPABASE_URL,
  NEW_SUPABASE_SERVICE_ROLE_KEY,
  SEED_ADMIN_EMAIL,
  SEED_GESTAO_EMAIL,
} = process.env as Record<string, string>;

const EXPORT_DIR = process.env.SEED_EXPORT_DIR ?? "./export";

for (const k of [
  "NEW_SUPABASE_URL",
  "NEW_SUPABASE_SERVICE_ROLE_KEY",
  "SEED_ADMIN_EMAIL",
]) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
}

const newDb = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- resolução de usuários no NOVO Supabase ----------

async function listAllNewAuthUsers(): Promise<Record<string, string>> {
  const emailToId: Record<string, string> = {};
  let page = 1;
  const perPage = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await newDb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) emailToId[u.email.toLowerCase()] = u.id;
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return emailToId;
}

function loadJson<T = Record<string, unknown>>(name: string): T[] | null {
  const p = `${EXPORT_DIR}/${name}.json`;
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as T[];
}

// ---------- mapa old user_id → new user_id ----------

type OldProfile = { user_id?: string; email?: string };

function buildUserIdMap(
  oldProfiles: OldProfile[],
  emailToNewId: Record<string, string>,
  adminFallbackId: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of oldProfiles) {
    if (!p.user_id) continue;
    const email = (p.email ?? "").toLowerCase();
    const matched = email ? emailToNewId[email] : undefined;
    map[p.user_id] = matched ?? adminFallbackId;
  }
  return map;
}

// ---------- ordem de seed (respeita FKs) ----------
type TableSpec = {
  name: string;
  userIdCols?: string[];     // colunas que apontam para auth.users(id)
  upsertOn?: string;         // se setado, usa upsert com onConflict nessa(s) coluna(s)
};

const TABLES: TableSpec[] = [
  { name: "business_units" },
  { name: "bank_accounts" },
  { name: "clients" },
  { name: "import_batches",          userIdCols: ["imported_by"] },
  { name: "bank_statement_entries" },
  { name: "financial_entries",       userIdCols: ["user_id"] },
  { name: "conciliation_matches",    userIdCols: ["confirmed_by"] },
  { name: "devis",
    userIdCols: ["created_by", "commercial_responsible", "validated_by"] },
  { name: "services",                userIdCols: ["assigned_to"] },
  { name: "system_settings",         userIdCols: ["updated_by"] },
  { name: "api_keys",                userIdCols: ["created_by"] },
  { name: "audit_logs",              userIdCols: ["user_id"] },
  { name: "email_send_log" },
  { name: "email_send_state" },
  { name: "email_unsubscribe_tokens" },
  { name: "suppressed_emails" },
  // profiles: handle_new_user já inseriu uma linha vazia para cada usuário
  // criado no Auth → upsert por user_id para sobrescrever sem colidir.
  { name: "profiles",                userIdCols: ["user_id"], upsertOn: "user_id" },
  // user_roles: UNIQUE(user_id, role) → upsert evita erro se admin novo
  // já tiver alguma role pré-atribuída.
  { name: "user_roles",              userIdCols: ["user_id"], upsertOn: "user_id,role" },
];

function remapRow(
  row: Record<string, unknown>,
  cols: string[] | undefined,
  oldToNew: Record<string, string>,
  adminFallbackId: string,
): Record<string, unknown> {
  if (!cols?.length) return row;
  const out = { ...row };
  for (const c of cols) {
    const v = out[c];
    if (typeof v === "string") {
      out[c] = oldToNew[v] ?? adminFallbackId;
    }
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
      mkdirSync(`${EXPORT_DIR}/_failed`, { recursive: true });
      writeFileSync(
        `${EXPORT_DIR}/_failed/${table}_${i}.json`,
        JSON.stringify(chunk, null, 2),
      );
      throw error;
    }
  }
}

async function main() {
  if (!existsSync(EXPORT_DIR)) {
    console.error(`Diretório de snapshots não encontrado: ${EXPORT_DIR}`);
    console.error(`Defina SEED_EXPORT_DIR ou crie ./export/<tabela>.json`);
    process.exit(1);
  }

  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (sem escrita)" : "INSERT/UPSERT no destino"}`);
  console.log(`Snapshots em: ${EXPORT_DIR}\n`);

  // 1) lista usuários do novo Auth
  console.log("→ Lendo usuários do novo Supabase Auth...");
  const emailToNewId = await listAllNewAuthUsers();
  const adminEmail = SEED_ADMIN_EMAIL.toLowerCase();
  const adminFallbackId = emailToNewId[adminEmail];
  if (!adminFallbackId) {
    console.error(
      `\n✗ Usuário admin "${SEED_ADMIN_EMAIL}" não encontrado no novo Supabase Auth.\n` +
      `  Crie-o manualmente antes de rodar o seed.`,
    );
    process.exit(1);
  }
  console.log(`  ✓ admin fallback: ${SEED_ADMIN_EMAIL} → ${adminFallbackId}`);
  if (SEED_GESTAO_EMAIL) {
    const gid = emailToNewId[SEED_GESTAO_EMAIL.toLowerCase()];
    if (gid) console.log(`  ✓ gestao: ${SEED_GESTAO_EMAIL} → ${gid}`);
    else console.log(`  ⚠ ${SEED_GESTAO_EMAIL} não encontrado no Auth (seguindo só com admin)`);
  }
  console.log(`  ✓ ${Object.keys(emailToNewId).length} usuários carregados do novo Auth\n`);

  // 2) constrói mapa old → new a partir de profiles.json
  console.log("→ Construindo mapa old user_id → new user_id a partir de profiles.json...");
  const oldProfiles = loadJson<OldProfile>("profiles");
  if (!oldProfiles) {
    console.error(`✗ ${EXPORT_DIR}/profiles.json não encontrado — obrigatório para o remap.`);
    process.exit(1);
  }
  const oldToNew = buildUserIdMap(oldProfiles, emailToNewId, adminFallbackId);
  const matched = Object.values(oldToNew).filter((v) => v !== adminFallbackId).length;
  const fallback = Object.keys(oldToNew).length - matched;
  console.log(`  ✓ ${Object.keys(oldToNew).length} user_ids antigos mapeados`);
  console.log(`    - ${matched} casados por email`);
  console.log(`    - ${fallback} caíram no admin fallback\n`);

  // 3) seed das tabelas
  for (const spec of TABLES) {
    process.stdout.write(`→ ${spec.name.padEnd(28)} `);
    const rows = loadJson(spec.name);
    if (rows === null) {
      process.stdout.write("snapshot ausente — pulando\n");
      continue;
    }
    const remapped = rows.map((r) =>
      remapRow(r as Record<string, unknown>, spec.userIdCols, oldToNew, adminFallbackId),
    );
    process.stdout.write(`rows=${remapped.length}`);

    if (!DRY_RUN) {
      await insertChunked(spec.name, remapped, spec.upsertOn);
      process.stdout.write(`  ${spec.upsertOn ? "upserted" : "inserted"}=${remapped.length}`);
    }
    process.stdout.write("\n");
  }

  console.log("\n✓ concluído");
  if (!DRY_RUN) {
    console.log("\nLEMBRETES:");
    console.log(`  • UUIDs sem correspondência por email foram remapeados para`);
    console.log(`    ${SEED_ADMIN_EMAIL} (${adminFallbackId}).`);
    console.log(`  • Reabilite os triggers de devis se você os desabilitou:`);
    console.log(`      ALTER TABLE public.devis ENABLE TRIGGER trg_devis_accepted_create_service;`);
    console.log(`      ALTER TABLE public.devis ENABLE TRIGGER trg_devis_accepted_create_charge;`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
