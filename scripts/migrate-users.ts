/**
 * scripts/migrate-users.ts
 *
 * Cria os 2 usuários do projeto antigo no NOVO projeto Supabase Pro
 * (uxwdzcjhrhlugrjgpkcr) e gera scripts/user-id-map.json, consumido
 * depois por seed-data.ts para remapear todas as FKs para auth.users.
 *
 * Estratégia: RESET DE SENHA UNIVERSAL (decidido pelo usuário).
 *  - Usuários são criados com email_confirm=true.
 *  - Para cada um, gera-se um magic-link de recovery; o link é impresso
 *    no stdout. Envio por Resend fica como TODO opcional.
 *  - Google OAuth é re-vinculado automaticamente no primeiro login com
 *    o mesmo e-mail confirmado (auth.identities é recriada pela Supabase).
 *
 * Pré-requisitos:
 *   bun add @supabase/supabase-js dotenv
 *   scripts/.env com:
 *     OLD_SUPABASE_URL=...
 *     OLD_SUPABASE_SERVICE_ROLE_KEY=...
 *     NEW_SUPABASE_URL=...
 *     NEW_SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Uso:
 *   bun run scripts/migrate-users.ts
 *
 * Output:
 *   scripts/user-id-map.json   { "<old-uuid>": "<new-uuid>", ... }
 *   stdout                     links de recovery para distribuir
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: new URL("./.env", import.meta.url).pathname });

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

const oldAdmin = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const newAdmin = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type OldUser = { id: string; email: string; raw_user_meta_data: Record<string, unknown> | null };

async function listOldUsers(): Promise<OldUser[]> {
  const collected: OldUser[] = [];
  let page = 1;
  // listUsers paginates server-side; default perPage = 50
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await oldAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) {
      if (!u.email) continue;
      collected.push({
        id: u.id,
        email: u.email,
        raw_user_meta_data: (u.user_metadata as Record<string, unknown>) ?? null,
      });
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return collected;
}

async function ensureNewUser(old: OldUser): Promise<string> {
  // Tenta achar existente por e-mail (idempotência se rodar múltiplas vezes)
  const { data: existing } = await newAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing.users.find((u) => u.email?.toLowerCase() === old.email.toLowerCase());
  if (found) {
    console.log(`↻ já existia: ${old.email} → ${found.id}`);
    return found.id;
  }

  const fullName =
    (old.raw_user_meta_data && (old.raw_user_meta_data.full_name as string)) || "";
  const { data, error } = await newAdmin.auth.admin.createUser({
    email: old.email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  console.log(`✓ criado: ${old.email} → ${data.user!.id}`);
  return data.user!.id;
}

async function recoveryLink(email: string): Promise<string | null> {
  const { data, error } = await newAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) {
    console.warn(`! falha ao gerar recovery para ${email}: ${error.message}`);
    return null;
  }
  return data.properties?.action_link ?? null;
}

async function main() {
  console.log("→ Listando usuários do projeto antigo...");
  const oldUsers = await listOldUsers();
  console.log(`  ${oldUsers.length} usuário(s) encontrado(s).`);

  const map: Record<string, string> = {};
  const recoveryLinks: Array<{ email: string; link: string }> = [];

  for (const u of oldUsers) {
    const newId = await ensureNewUser(u);
    map[u.id] = newId;
    const link = await recoveryLink(u.email);
    if (link) recoveryLinks.push({ email: u.email, link });
  }

  const outPath = new URL("./user-id-map.json", import.meta.url).pathname;
  writeFileSync(outPath, JSON.stringify(map, null, 2));
  console.log(`\n→ user-id-map.json gravado em ${outPath}`);

  console.log("\n=== LINKS DE RECOVERY (envie aos usuários) ===");
  for (const { email, link } of recoveryLinks) {
    console.log(`\n${email}\n${link}`);
  }
  console.log("\n=== FIM ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
