// Extrai transações de um extrato bancário PDF usando OpenAI (chat.completions com PDF)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, fileName } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");
    if (!fileBase64) throw new Error("fileBase64 é obrigatório");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "Extraia TODAS as transações de um extrato bancário. Datas em ISO (YYYY-MM-DD). Valores em número (positivo crédito, negativo débito)." },
          {
            role: "user",
            content: [
              { type: "text", text: `Analise o extrato${fileName ? ` "${fileName}"` : ""} e extraia todas as transações.` },
              {
                type: "file",
                file: {
                  filename: fileName || "extrato.pdf",
                  file_data: `data:application/pdf;base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_transactions",
            parameters: {
              type: "object",
              properties: {
                bank_name: { type: "string" },
                account: { type: "string" },
                period_start: { type: "string" },
                period_end: { type: "string" },
                transactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      description: { type: "string" },
                      amount: { type: "number" },
                      document: { type: "string" },
                    },
                    required: ["date", "description", "amount"],
                  },
                },
              },
              required: ["transactions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_transactions" } },
      }),
    });

    if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições da OpenAI atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (response.status === 401) return new Response(JSON.stringify({ error: "Chave OPENAI_API_KEY inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) { const t = await response.text(); console.error("OpenAI error:", response.status, t); throw new Error(`OpenAI: ${response.status}`); }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Resposta sem tool_call");
    const data = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("parse-bank-statement-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
