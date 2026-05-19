// Gera estrutura de proposta (Devis) a partir de um relatório de reunião usando Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { meeting_report, client_name, total_amount, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!meeting_report) throw new Error("meeting_report é obrigatório");

    const lang = (["pt", "fr", "en", "es"].includes(language) ? language : "pt") as "pt" | "fr" | "en" | "es";
    const langName = { pt: "português do Brasil", fr: "français", en: "English", es: "español" }[lang];

    const systemPrompt = `Você é um assistente comercial multilíngue especializado em criar propostas comerciais (devis) de serviços. Gere uma proposta estruturada, formal e detalhada COMPLETAMENTE em ${langName}, sem misturar idiomas. Todos os campos textuais (title, scope_description, proposal_structure, scope_items[].title, scope_items[].description) devem estar 100% em ${langName}. Não traduza nomes próprios, valores monetários, datas, números ou siglas.`;

    const userPrompt = `Relatório da reunião com o cliente${client_name ? ` "${client_name}"` : ""}:\n\n${meeting_report}\n\n${total_amount ? `Valor total alvo: R$ ${total_amount}\n\n` : ""}Gere a estrutura completa da proposta em ${langName}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "build_proposal",
              description: "Estrutura a proposta comercial",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  service_type: { type: "string" },
                  responsible_sector: { type: "string" },
                  scope_description: { type: "string" },
                  proposal_structure: { type: "string", description: "Texto formal completo da proposta" },
                  scope_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        letter: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        amount: { type: "number" },
                      },
                      required: ["letter", "title", "description", "amount"],
                    },
                  },
                  total_amount: { type: "number" },
                  deadline_date: { type: "string", description: "ISO date YYYY-MM-DD" },
                },
                required: ["title", "scope_description", "proposal_structure", "scope_items", "total_amount"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "build_proposal" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Resposta sem tool_call");
    const proposal = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ proposal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-devis-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
