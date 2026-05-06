// Analisa ata de reunião (PDF/imagem/texto) e extrai cliente + estrutura de devis
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_name, mime_type, language_hint } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!file_base64) throw new Error("file_base64 é obrigatório");

    const langInstr = language_hint && language_hint !== "auto" ? `O idioma do documento é ${language_hint}.` : "Detecte automaticamente o idioma.";

    const systemPrompt = `Você é um analista comercial. Receba uma ata de reunião e extraia: (1) idioma detectado, (2) dados do cliente, (3) resumo da reunião, (4) estrutura inicial da proposta comercial. Responda sempre em pt-BR nos campos textuais finais.`;

    const userContent: any[] = [
      { type: "text", text: `Analise esta ata${file_name ? ` (${file_name})` : ""}. ${langInstr}` },
    ];
    if (mime_type?.startsWith("image/")) {
      userContent.push({ type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } });
    } else {
      // PDF/texto: enviamos como texto decodificado se possível
      try {
        const decoded = atob(file_base64);
        userContent.push({ type: "text", text: `Conteúdo do arquivo:\n${decoded.slice(0, 50000)}` });
      } catch {
        userContent.push({ type: "image_url", image_url: { url: `data:${mime_type || "application/pdf"};base64,${file_base64}` } });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_meeting",
            parameters: {
              type: "object",
              properties: {
                detected_language: { type: "string", enum: ["pt", "fr", "en", "es"] },
                client: {
                  type: "object",
                  properties: {
                    name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
                    document: { type: "string" }, type: { type: "string", enum: ["PF", "PJ", ""] },
                    address: { type: "string" }, city: { type: "string" }, notes: { type: "string" },
                  },
                  required: ["name", "email", "phone", "document", "type", "address", "city", "notes"],
                },
                meeting: {
                  type: "object",
                  properties: { date: { type: "string" }, summary: { type: "string" }, report: { type: "string" } },
                  required: ["date", "summary", "report"],
                },
                devis: {
                  type: "object",
                  properties: {
                    title: { type: "string" }, service_type: { type: "string" }, responsible_sector: { type: "string" },
                    scope_description: { type: "string" }, proposal_structure: { type: "string" },
                    scope_items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { letter: { type: "string" }, title: { type: "string" }, description: { type: "string" }, amount: { type: "number" } },
                        required: ["letter", "title", "description", "amount"],
                      },
                    },
                    total_amount: { type: "number" }, deadline_date: { type: "string" },
                  },
                  required: ["title", "service_type", "responsible_sector", "scope_description", "proposal_structure", "scope_items", "total_amount", "deadline_date"],
                },
              },
              required: ["detected_language", "client", "meeting", "devis"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_meeting" } },
      }),
    });

    if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) { const t = await response.text(); console.error("AI error:", response.status, t); throw new Error(`AI gateway: ${response.status}`); }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Resposta sem tool_call");
    const payload = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ payload }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-meeting-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
