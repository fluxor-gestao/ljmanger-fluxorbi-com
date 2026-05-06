// Envia proposta (devis) por e-mail via Resend e marca como enviada no banco
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "Lundgaard Jensen <onboarding@resend.dev>";
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { devis_id, to, subject, message_text, pdf_base64, pdf_filename, accept_url } = await req.json();
    if (!to?.length || !subject || !message_text) throw new Error("Parâmetros inválidos");

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a1a">
        <div style="white-space:pre-wrap;line-height:1.6">${message_text.replace(/</g, "&lt;")}</div>
        ${accept_url ? `<div style="margin:32px 0;text-align:center"><a href="${accept_url}" style="background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Aceitar Proposta</a></div>` : ""}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <div style="font-size:12px;color:#6b7280">Lundgaard Jensen — Advocacia e Consultoria Internacional</div>
      </div>`;

    const payload: any = {
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlBody,
      text: message_text + (accept_url ? `\n\nAceitar: ${accept_url}` : ""),
    };
    if (pdf_base64 && pdf_filename) {
      payload.attachments = [{ filename: pdf_filename, content: pdf_base64 }];
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("Resend error:", r.status, t);
      throw new Error(`Falha ao enviar e-mail: ${r.status}`);
    }
    const sendResult = await r.json();

    if (devis_id) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      await admin.from("devis").update({ status: "enviada_ao_cliente", sent_at: new Date().toISOString() }).eq("id", devis_id);
    }

    return new Response(JSON.stringify({ ok: true, id: sendResult.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-devis-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
