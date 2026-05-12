// Aceite/recusa público de proposta (devis) via accept_token
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PREVIEW_FIELDS =
  "title, total_amount, down_payment_amount, deadline_date, scope_description, proposal_structure, accepted_at, rejected_at, client_id";

function previewPayload(devis: any, clientName: string | null) {
  return {
    title: devis.title,
    client_name: clientName,
    total_amount: Number(devis.total_amount) || 0,
    down_payment_amount: Number(devis.down_payment_amount) || 0,
    deadline_date: devis.deadline_date,
    scope_description: devis.scope_description,
    proposal_structure: devis.proposal_structure,
    accepted_at: devis.accepted_at,
    rejected_at: devis.rejected_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action"); // "reject" or default accept

    if (!token) return json({ error: "token ausente" }, 400);

    const { data: devis, error } = await admin
      .from("devis")
      .select(PREVIEW_FIELDS)
      .eq("accept_token", token)
      .maybeSingle();

    if (error) {
      console.error("select devis error", error);
      return json({ error: "Erro ao buscar proposta" }, 500);
    }
    if (!devis) return json({ error: "Proposta não encontrada" }, 404);

    let clientName: string | null = null;
    if (devis.client_id) {
      const { data: client } = await admin
        .from("clients")
        .select("name")
        .eq("id", devis.client_id)
        .maybeSingle();
      clientName = client?.name ?? null;
    }

    if (req.method === "GET") {
      return json(previewPayload(devis, clientName));
    }

    if (req.method === "POST") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("cf-connecting-ip") ||
        null;

      if (action === "reject") {
        if (devis.rejected_at || devis.accepted_at) {
          return json(previewPayload(devis, clientName));
        }
        let reason: string | null = null;
        try {
          const body = await req.json();
          reason = body?.reason ? String(body.reason).slice(0, 1000) : null;
        } catch {}
        const updates: any = {
          rejected_at: new Date().toISOString(),
          status: "recusada",
          rejected_ip: ip,
        };
        if (reason) updates.notes = reason;

        const { data: updated, error: upErr } = await admin
          .from("devis")
          .update(updates)
          .eq("accept_token", token)
          .select(PREVIEW_FIELDS)
          .maybeSingle();
        if (upErr) {
          console.error("reject update error", upErr);
          return json({ error: "Erro ao registrar recusa" }, 500);
        }
        return json(previewPayload(updated, clientName));
      }

      // Default: accept
      if (devis.accepted_at || devis.rejected_at) {
        return json(previewPayload(devis, clientName));
      }
      const { data: updated, error: upErr } = await admin
        .from("devis")
        .update({
          accepted_at: new Date().toISOString(),
          status: "aceita",
          accepted_ip: ip,
        })
        .eq("accept_token", token)
        .select(PREVIEW_FIELDS)
        .maybeSingle();
      if (upErr) {
        console.error("accept update error", upErr);
        return json({ error: "Erro ao registrar aceite" }, 500);
      }
      return json(previewPayload(updated, clientName));
    }

    return json({ error: "Método não suportado" }, 405);
  } catch (e) {
    console.error("accept-devis-proposal error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
