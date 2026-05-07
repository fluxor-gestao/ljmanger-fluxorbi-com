import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

export const Route = createFileRoute("/api/public/bi-financeiro")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "financeiro");
        if (!auth.ok) return auth.response;

        const dataset = auth.url.searchParams.get("dataset") || "financial_entries";
        const table = dataset === "bank_statement" ? "bank_statement_entries" : "financial_entries";
        const dateColumn = table === "bank_statement_entries" ? "transaction_date" : "entry_date";

        let q = supabaseAdmin
          .from(table)
          .select("*", { count: "exact" })
          .order(dateColumn, { ascending: false });
        if (auth.from) q = q.gte(dateColumn, auth.from);
        if (auth.to) q = q.lte(dateColumn, auth.to);

        const offset = (auth.page - 1) * auth.pageSize;
        q = q.range(offset, offset + auth.pageSize - 1);

        const { data, error, count } = await q;
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          dataset: table,
          data,
          meta: { page: auth.page, page_size: auth.pageSize, total: count ?? 0 },
        });
      },
    },
  },
});
