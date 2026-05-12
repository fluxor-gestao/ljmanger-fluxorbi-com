// Envia proposta (devis) por e-mail via Resend e marca como enviada no banco
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "pt" | "fr" | "en" | "es";

const I18N: Record<Lang, { tagline: string; cta_help: string; accept: string; reject: string }> = {
  pt: {
    tagline: "ADVOCACIA & CONSULTORIA INTERNACIONAL",
    cta_help: "Você pode aceitar ou recusar a proposta clicando nos botões abaixo.",
    accept: "Aceitar Proposta",
    reject: "Recusar",
  },
  fr: {
    tagline: "AVOCATS & CONSEIL INTERNATIONAL",
    cta_help: "Vous pouvez accepter ou refuser la proposition en cliquant sur les boutons ci-dessous.",
    accept: "Accepter la Proposition",
    reject: "Refuser",
  },
  en: {
    tagline: "INTERNATIONAL LAW & CONSULTING",
    cta_help: "You can accept or reject the proposal by clicking the buttons below.",
    accept: "Accept Proposal",
    reject: "Reject",
  },
  es: {
    tagline: "ABOGADOS & CONSULTORÍA INTERNACIONAL",
    cta_help: "Puede aceptar o rechazar la propuesta haciendo clic en los botones a continuación.",
    accept: "Aceptar la Propuesta",
    reject: "Rechazar",
  },
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildHtml(messageText: string, acceptUrl: string | undefined, lang: Lang) {
  const t = I18N[lang] ?? I18N.pt;
  const ctaBlock = acceptUrl
    ? `
      <p style="margin:28px 0 14px;text-align:center;font-size:13px;color:#4b5563">${t.cta_help}</p>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr>
          <td style="padding:0 6px">
            <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-family:Arial,sans-serif;font-size:14px">${t.accept}</a>
          </td>
          <td style="padding:0 6px">
            <a href="${acceptUrl}" style="display:inline-block;background:#ffffff;color:#dc2626;padding:12px 28px;border:1px solid #dc2626;border-radius:6px;text-decoration:none;font-weight:600;font-family:Arial,sans-serif;font-size:14px">${t.reject}</a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%">
        <tr><td style="padding:28px 36px 0">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:2px;color:#0f172a">LUNDGAARD JENSEN</div>
          <div style="font-size:11px;letter-spacing:3px;color:#1e40af;margin-top:4px">${t.tagline}</div>
          <div style="height:2px;background:#c8a96a;margin:14px 0 0"></div>
        </td></tr>
        <tr><td style="padding:24px 36px 8px">
          <div style="white-space:pre-wrap;line-height:1.65;font-size:14px;color:#1f2937">${escapeHtml(messageText)}</div>
        </td></tr>
        <tr><td style="padding:8px 36px 32px">${ctaBlock}</td></tr>
        <tr><td style="padding:0 36px 24px">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 14px" />
          <div style="font-size:11px;color:#6b7280;line-height:1.6">
            Rua João Cordeiro, 831 — Praia de Iracema<br/>
            +55 (85) 9 9406-6042 &nbsp;|&nbsp; +55 (85) 9 3037-9931<br/>
            <a href="https://lundgaardjensen.com" style="color:#1e40af;text-decoration:none">lundgaardjensen.com</a> &nbsp;|&nbsp; @lundgaard.jensen
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "Lundgaard Jensen <onboarding@resend.dev>";
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { devis_id, to, subject, message_text, pdf_base64, pdf_filename, accept_url, language } = await req.json();
    if (!to?.length || !subject || !message_text) throw new Error("Parâmetros inválidos");

    const lang: Lang = (["pt", "fr", "en", "es"].includes(language) ? language : "pt") as Lang;
    const htmlBody = buildHtml(message_text, accept_url, lang);

    const payload: any = {
      from: FROM_EMAIL,
      to,
      subject,
      html: htmlBody,
      text: message_text + (accept_url ? `\n\n${I18N[lang].accept}: ${accept_url}` : ""),
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
