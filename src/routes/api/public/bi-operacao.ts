import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

export const Route = createFileRoute("/api/public/bi-operacao")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "operacao");
        if (!auth.ok) return auth.response;

        let q = supabaseAdmin
          .from("services")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false });
        if (auth.from) q = q.gte("created_at", auth.from);
        if (auth.to) q = q.lte("created_at", auth.to);

        const offset = (auth.page - 1) * auth.pageSize;
        q = q.range(offset, offset + auth.pageSize - 1);

        const { data, error, count } = await q;
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          data,
          meta: { page: auth.page, page_size: auth.pageSize, total: count ?? 0 },
        });
      },
    },
  },
});
