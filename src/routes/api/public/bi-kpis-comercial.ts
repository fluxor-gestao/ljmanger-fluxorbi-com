import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, fetchAll, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

type Row = {
  status: string;
  total_amount: number | null;
  created_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
};

export const Route = createFileRoute("/api/public/bi-kpis-comercial")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "comercial");
        if (!auth.ok) return auth.response;

        const { data: rows, total, error } = await fetchAll<Row>((from, to) => {
          let q = supabaseAdmin
            .from("devis")
            .select("status,total_amount,created_at,accepted_at,rejected_at", { count: "exact" });
          if (auth.from) q = q.gte("created_at", auth.from);
          if (auth.to) q = q.lte("created_at", auth.to);
          return q.range(from, to);
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        const totalCount = rows.length;
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
            total_devis: totalCount,
            accepted,
            rejected,
            conversion_rate: totalCount ? accepted / totalCount : 0,
            total_amount: totalAmount,
            accepted_amount: acceptedAmount,
            avg_ticket: totalCount ? totalAmount / totalCount : 0,
            by_status: byStatus,
          },
          meta: { from: auth.from, to: auth.to, rows_scanned: total },
        });
      },
    },
  },
});
