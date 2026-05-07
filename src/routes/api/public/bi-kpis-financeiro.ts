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

        let q = supabaseAdmin
          .from("financial_entries")
          .select("entry_date,amount_in,amount_out,business_unit");
        if (auth.from) q = q.gte("entry_date", auth.from);
        if (auth.to) q = q.lte("entry_date", auth.to);

        const { data, error } = await q;
        if (error) return jsonResponse({ error: error.message }, 500);

        const rows = data ?? [];
        const totalIn = rows.reduce((s, r) => s + Number(r.amount_in || 0), 0);
        const totalOut = rows.reduce((s, r) => s + Number(r.amount_out || 0), 0);

        const byMonth: Record<string, { in: number; out: number; net: number }> = {};
        for (const r of rows) {
          const month = r.entry_date ? String(r.entry_date).slice(0, 7) : "sem-data";
          const m = (byMonth[month] ||= { in: 0, out: 0, net: 0 });
          m.in += Number(r.amount_in || 0);
          m.out += Number(r.amount_out || 0);
          m.net = m.in - m.out;
        }

        return jsonResponse({
          data: {
            total_in: totalIn,
            total_out: totalOut,
            net: totalIn - totalOut,
            entries_count: rows.length,
            by_month: byMonth,
          },
          meta: { from: auth.from, to: auth.to },
        });
      },
    },
  },
});
