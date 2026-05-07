// Server-only helper for public BI endpoints.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
} as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type BiAuthOk = {
  ok: true;
  url: URL;
  page: number;
  pageSize: number;
  all: boolean;
  from: string | null;
  to: string | null;
};
export type BiAuthFail = { ok: false; response: Response };

export async function validateBiRequest(
  request: Request,
  requiredScope: "comercial" | "financeiro" | "operacao",
): Promise<BiAuthOk | BiAuthFail> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-api-key") || "";

  if (!token) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "Missing API token. Pass ?token=lk_xxx in the URL." },
        401,
      ),
    };
  }

  const hash = await sha256Hex(token);
  const { data, error } = await supabaseAdmin.rpc("validate_api_key", { _key_hash: hash });
  if (error) return { ok: false, response: jsonResponse({ error: error.message }, 500) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, response: jsonResponse({ error: "Invalid or revoked API token." }, 401) };
  }

  const scopes: string[] = row.scopes || [];
  if (!scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: jsonResponse(
        { error: `This API token does not have access to the '${requiredScope}' scope.` },
        403,
      ),
    };
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number(url.searchParams.get("page_size")) || 500));
  const all = url.searchParams.get("all") === "true" || url.searchParams.get("all") === "1";

  return {
    ok: true,
    url,
    page,
    pageSize,
    all,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  };
}

const MAX_ALL_ROWS = 200_000;
const CHUNK = 1000;

/**
 * Fetch all rows by iterating in chunks of 1000 (Supabase hard limit per request).
 * `buildRange(from, to)` should return a configured Supabase query for that range.
 */
export async function fetchAll<T>(
  buildRange: (from: number, to: number) => any,
): Promise<{ data: T[]; total: number; error: any }> {
  const all: T[] = [];
  let offset = 0;
  let total = 0;
  while (offset < MAX_ALL_ROWS) {
    const { data, error, count } = await buildRange(offset, offset + CHUNK - 1);
    if (error) return { data: all, total, error };
    if (typeof count === "number") total = count;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < CHUNK) break;
    offset += CHUNK;
  }
  return { data: all, total: total || all.length, error: null };
}
