import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

export const Route = createFileRoute("/api/public/bi-kpis-comercial")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "comercial");
        if (!auth.ok) return auth.response;

        let q = supabaseAdmin.from("devis").select("status,total_amount,created_at,accepted_at,rejected_at");
        if (auth.from) q = q.gte("created_at", auth.from);
        if (auth.to) q = q.lte("created_at", auth.to);

        const { data, error } = await q;
        if (error) return jsonResponse({ error: error.message }, 500);

        const rows = data ?? [];
        const total = rows.length;
        const accepted = rows.filter((r) => r.accepted_at).length;
        const rejected = rows.filter((r) => r.rejected_at).length;
        const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        const acceptedAmount = rows
          .filter((r) => r.accepted_at)
          .reduce((s, r) => s + Number(r.total_amount || 0), 0);

        const byStatus: Record<string, number> = {};
        for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

        return jsonResponse({
          data: {
            total_devis: total,
            accepted,
            rejected,
            conversion_rate: total ? accepted / total : 0,
            total_amount: totalAmount,
            accepted_amount: acceptedAmount,
            avg_ticket: total ? totalAmount / total : 0,
            by_status: byStatus,
          },
          meta: { from: auth.from, to: auth.to },
        });
      },
    },
  },
});
