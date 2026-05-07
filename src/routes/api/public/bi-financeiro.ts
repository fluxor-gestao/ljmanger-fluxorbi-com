import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, fetchAll, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

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

        const base = () => {
          let q = supabaseAdmin
            .from(table)
            .select("*", { count: "exact" })
            .order(dateColumn, { ascending: false });
          if (auth.from) q = q.gte(dateColumn, auth.from);
          if (auth.to) q = q.lte(dateColumn, auth.to);
          return q;
        };

        if (auth.all) {
          const { data, total, truncated, error } = await fetchAll((from, to) => base().range(from, to));
          if (error) return jsonResponse({ error: error.message }, 500);
          return jsonResponse({
            dataset: table,
            data,
            meta: {
              total,
              all: true,
              truncated,
              ...(truncated && {
                warning: "Result truncated at 200000 rows. Reduce your from/to window.",
              }),
            },
          });
        }

        const offset = (auth.page - 1) * auth.pageSize;
        const { data, error, count } = await base().range(offset, offset + auth.pageSize - 1);
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
