import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

export const Route = createFileRoute("/api/public/bi-kpis-financeiro")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "financeiro");
        if (!auth.ok) return auth.response;

        const { data, error } = await (supabaseAdmin.rpc as any)("bi_kpis_financeiro", {
          _from: auth.from,
          _to: auth.to,
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          data,
          meta: { from: auth.from, to: auth.to, source: "rpc:bi_kpis_financeiro" },
        });
      },
    },
  },
});
