// Traduz campos textuais de um devis para um idioma alvo (visualização apenas) — OpenAI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAME: Record<string, string> = {
  pt: "português do Brasil",
  fr: "français",
  en: "English",
  es: "español",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fields, target_language, source_language } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");
    if (!fields || typeof fields !== "object") throw new Error("fields é obrigatório");

    const target = LANG_NAME[target_language] || LANG_NAME.pt;
    const source = LANG_NAME[source_language] || "idioma original";

    const systemPrompt = `Você é um tradutor profissional. Traduza os textos fornecidos de ${source} para ${target}, mantendo:
- Formato e estrutura (listas, parágrafos, marcadores A/B/C, 1/2/3, etc.)
- Valores monetários (R$), datas, números e siglas intactos
- Tom formal de proposta comercial
- Nomes próprios sem tradução
Retorne SOMENTE o JSON com as mesmas chaves, valores traduzidos. Nada além do JSON.`;

    const userPrompt = `Traduza os seguintes campos para ${target}. Retorne objeto JSON com as mesmas chaves:\n\n${JSON.stringify(fields, null, 2)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições da OpenAI atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (response.status === 401) return new Response(JSON.stringify({ error: "Chave OPENAI_API_KEY inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) { const t = await response.text(); console.error("OpenAI error:", response.status, t); throw new Error(`OpenAI: ${response.status}`); }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da IA");
    const translated = JSON.parse(content);

    return new Response(JSON.stringify({ translated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("translate-devis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
