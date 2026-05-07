// Server-only helper for public BI endpoints.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
} as const;

export const MAX_ALL_ROWS = 200_000;
export const CHUNK = 1000;
export const MAX_WINDOW_DAYS = 366;

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (all) {
    if (!from || !to) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error:
              "When using ?all=true you MUST also pass ?from=YYYY-MM-DD&to=YYYY-MM-DD to bound the result set.",
          },
          400,
        ),
      };
    }
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return {
        ok: false,
        response: jsonResponse(
          { error: "Invalid date format. Use YYYY-MM-DD for from/to." },
          400,
        ),
      };
    }
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (Number.isNaN(days) || days < 0) {
      return {
        ok: false,
        response: jsonResponse({ error: "'to' must be greater than or equal to 'from'." }, 400),
      };
    }
    if (days > MAX_WINDOW_DAYS) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: `Window too large: max ${MAX_WINDOW_DAYS} days when ?all=true. Split your request into smaller windows.`,
          },
          400,
        ),
      };
    }
  }

  return { ok: true, url, page, pageSize, all, from, to };
}

/**
 * Fetch all rows by iterating in chunks of 1000 (Supabase hard limit per request).
 * Returns `truncated: true` if MAX_ALL_ROWS was hit and there were likely more rows available.
 */
export async function fetchAll<T>(
  buildRange: (from: number, to: number) => any,
): Promise<{ data: T[]; total: number; truncated: boolean; error: any }> {
  const all: T[] = [];
  let offset = 0;
  let total = 0;
  let truncated = false;
  while (offset < MAX_ALL_ROWS) {
    const { data, error, count } = await buildRange(offset, offset + CHUNK - 1);
    if (error) return { data: all, total, truncated, error };
    if (typeof count === "number") total = count;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < CHUNK) break;
    offset += CHUNK;
    if (offset >= MAX_ALL_ROWS) {
      // We filled the cap with full chunks → almost certainly more rows exist.
      truncated = true;
      break;
    }
  }
  if (!truncated && total > all.length) truncated = true;
  return { data: all, total: total || all.length, truncated, error: null };
}
