import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CORS_HEADERS, fetchAll, jsonResponse, validateBiRequest } from "@/lib/bi-auth.server";

type Row = {
  status: string;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  created_at: string | null;
};

export const Route = createFileRoute("/api/public/bi-kpis-operacao")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const auth = await validateBiRequest(request, "operacao");
        if (!auth.ok) return auth.response;

        const { data: rows, total, error } = await fetchAll<Row>((from, to) => {
          let q = supabaseAdmin
            .from("services")
            .select("status,start_date,expected_end_date,actual_end_date,created_at", { count: "exact" });
          if (auth.from) q = q.gte("created_at", auth.from);
          if (auth.to) q = q.lte("created_at", auth.to);
          return q.range(from, to);
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        const byStatus: Record<string, number> = {};
        for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        const today = new Date().toISOString().slice(0, 10);
        const delayed = rows.filter(
          (r) => r.expected_end_date && !r.actual_end_date && String(r.expected_end_date) < today,
        ).length;
        const completed = rows.filter((r) => r.actual_end_date).length;

        return jsonResponse({
          data: {
            total_services: rows.length,
            completed,
            delayed,
            in_progress: rows.length - completed,
            by_status: byStatus,
          },
          meta: { from: auth.from, to: auth.to, rows_scanned: total },
        });
      },
    },
  },
});
