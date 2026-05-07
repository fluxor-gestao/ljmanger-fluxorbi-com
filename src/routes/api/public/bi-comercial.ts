import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, fetchAll, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

export const Route = createFileRoute("/api/public/bi-comercial")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "comercial");
        if (!auth.ok) return auth.response;

        const base = () => {
          let q = supabaseAdmin
            .from("devis")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });
          if (auth.from) q = q.gte("created_at", auth.from);
          if (auth.to) q = q.lte("created_at", auth.to);
          return q;
        };

        if (auth.all) {
          const { data, total, error } = await fetchAll((from, to) => base().range(from, to));
          if (error) return jsonResponse({ error: error.message }, 500);
          return jsonResponse({ data, meta: { total, all: true } });
        }

        const offset = (auth.page - 1) * auth.pageSize;
        const { data, error, count } = await base().range(offset, offset + auth.pageSize - 1);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({
          data,
          meta: { page: auth.page, page_size: auth.pageSize, total: count ?? 0 },
        });
      },
    },
  },
});
