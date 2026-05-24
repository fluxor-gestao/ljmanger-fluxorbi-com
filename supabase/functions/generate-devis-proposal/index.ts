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

    const hasTotal = typeof total_amount === "number" && total_amount > 0;

    const systemPrompt = `Você é um advogado sênior redator de propostas comerciais jurídicas (devis), multilíngue. Escreva uma proposta FORMAL, COMPLETA e DETALHADA, 100% em ${langName}, sem misturar idiomas. Não traduza nomes próprios, valores monetários, datas, números ou siglas.

REGRAS DE CONTEÚDO (obrigatórias):
- Personalize a proposta usando fatos concretos do relatório da reunião: contexto, partes envolvidas, pontos de dor, attentes, prazos, métricas, riscos. NUNCA escreva texto genérico.
- NUNCA use placeholders entre colchetes do tipo "[Insérer le lieu]", "[Inserir cliente]", "[XXX]". Se um dado não estiver disponível, simplesmente omita a linha.
- Tom formal jurídico, parágrafos bem construídos (não bullets soltos no texto corrido).

ESTRUTURA OBRIGATÓRIA DO CAMPO proposal_structure (Markdown, nesta ordem):

# {Título da proposta}

## I. Identification des Parties / Identificação das Partes
- **PRESTATAIRE / CONTRATADO:** Lundgaard Jensen Advocacia e Consultoria Internacional
- **CLIENT / CONTRATANTE:** {nome do cliente, e demais dados disponíveis}

## II. Contexte et Objet du Contrat
2 a 4 parágrafos densos descrevendo: (a) o contexto da reunião e situação atual do cliente, (b) o problema/desafio identificado, (c) o objetivo geral da contratação, (d) o resultado esperado. Citar fatos específicos do relatório.

### Étendue des Services / Escopo de Serviços
Lista A) B) C)... (no mínimo 3, idealmente 4–6 itens). Para CADA item siga EXATAMENTE este formato:

**A) Título do serviço — VALOR BRL**
*Description :* 3 a 6 frases descrevendo o serviço em profundidade, com base no relatório.
*Livrables :* lista curta dos entregáveis concretos (documentos, pareceres, atos).
*Parties prenantes :* quem participa (cliente, cabinet, notaire, architecte, etc.).
*Indicateurs de succès :* critérios mensuráveis de conclusão.
*Délai :* prazo estimado dessa etapa.

## III. Honoraires / Honorários
- Detalhar o **Total** dos serviços (deve bater EXATAMENTE com a soma dos itens A+B+C+...).
- **Entrada de 50%** na assinatura: valor em BRL.
- **Saldo de 50%** na conclusão: valor em BRL.
- Condições de pagamento, forma (PIX/transferência), prazo de pagamento das parcelas.
- Cláusula curta de reajuste por IPCA caso a execução ultrapasse 12 meses.

## IV. Délai et Calendrier
Cronograma por fase, com marcos (kickoff, entregas intermediárias, encerramento). Datas relativas (ex.: "D+15", "D+30") quando não houver datas fixas no relatório.

## V. Obligations des Parties
Parágrafo curto descrevendo obrigações do prestataire (diligência, confidencialidade, relatórios periódicos) e do cliente (fornecer documentos, decisões tempestivas, pagamento).

## VI. Confidentialité et Propriété Intellectuelle
Parágrafo padrão jurídico (sigilo, NDA implícito, titularidade dos pareceres permanecendo do prestataire com licença de uso ao cliente).

## VII. Dispositions Finales
Foro de eleição (Fortaleza/CE, salvo indicação em contrário no relatório), rescisão por inadimplemento, vigência até a conclusão dos serviços ou 12 meses (o que ocorrer primeiro).

REGRAS DE VALORES (CRÍTICAS):
${
  hasTotal
    ? `- O cliente já definiu um VALOR TOTAL de R$ ${total_amount}. Distribua esse valor entre os itens de escopo proporcionalmente ao esforço de cada um. A soma dos amounts dos scope_items DEVE ser EXATAMENTE ${total_amount}. total_amount no retorno = ${total_amount}.`
    : `- O cliente NÃO informou valor total. Você DEVE ESTIMAR valores de mercado brasileiros plausíveis para cada item de escopo (em BRL), considerando complexidade jurídica. Faixas de referência (BRL):
  • Due diligence imobiliária completa: 15.000 a 60.000
  • Constituição de sociedade (LTDA/SA) com avenant: 8.000 a 25.000
  • Acompanhamento de procedimentos urbanísticos (licenças, alvarás): 10.000 a 40.000
  • Consultoria estratégica / negociação contratual pontual: 5.000 a 20.000
  • Pareceres jurídicos especializados: 4.000 a 15.000
  • Coordenação multidisciplinar (notário, arquiteto, etc.): 5.000 a 15.000
  Ajuste para cima em casos de alta complexidade, urgência ou cliente internacional. total_amount = soma exata dos amounts dos scope_items.`
}
- VALOR ZERO É PROIBIDO em qualquer scope_items[].amount.
- Todos os valores em BRL no markdown devem ser formatados como "BRL 12.345,00" (separador de milhar ".", decimal ",").`;

    const userPrompt = `Relatório da reunião com o cliente${client_name ? ` "${client_name}"` : ""}:

${meeting_report}

${hasTotal ? `Valor total alvo: R$ ${total_amount}\n` : "O cliente NÃO informou valor total — estime conforme as faixas do system prompt.\n"}
Gere a proposta jurídica completa em ${langName}, seguindo TODAS as seções obrigatórias (I a VII) e o formato detalhado de cada item de escopo. Personalize tudo com base no relatório acima.`;

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
              description: "Estrutura a proposta comercial jurídica completa",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título da proposta no idioma alvo" },
                  service_type: { type: "string" },
                  responsible_sector: { type: "string" },
                  scope_description: {
                    type: "string",
                    description: "Resumo executivo do escopo (2 a 4 frases densas), no idioma alvo",
                  },
                  proposal_structure: {
                    type: "string",
                    description:
                      "Texto Markdown COMPLETO da proposta, contendo OBRIGATORIAMENTE as 7 seções I a VII conforme instruído. Mínimo ~2500 caracteres.",
                  },
                  scope_items: {
                    type: "array",
                    minItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        letter: { type: "string", description: "A, B, C, ..." },
                        title: { type: "string" },
                        description: {
                          type: "string",
                          description: "3 a 6 frases descritivas do item",
                        },
                        deliverables: {
                          type: "array",
                          items: { type: "string" },
                          description: "Entregáveis concretos do item",
                        },
                        stakeholders: {
                          type: "array",
                          items: { type: "string" },
                        },
                        success_metrics: {
                          type: "array",
                          items: { type: "string" },
                        },
                        duration: { type: "string", description: "Prazo estimado da etapa" },
                        amount: {
                          type: "number",
                          description: "Valor em BRL, OBRIGATORIAMENTE > 0",
                          exclusiveMinimum: 0,
                        },
                      },
                      required: [
                        "letter",
                        "title",
                        "description",
                        "deliverables",
                        "duration",
                        "amount",
                      ],
                    },
                  },
                  milestones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        date: { type: "string", description: "ISO YYYY-MM-DD ou relativo (D+15)" },
                      },
                      required: ["label", "date"],
                    },
                  },
                  payment_terms: { type: "string" },
                  assumptions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Premissas e exclusões",
                  },
                  total_amount: {
                    type: "number",
                    description: "Soma EXATA dos amounts dos scope_items",
                    exclusiveMinimum: 0,
                  },
                  deadline_date: { type: "string", description: "ISO date YYYY-MM-DD" },
                },
                required: [
                  "title",
                  "scope_description",
                  "proposal_structure",
                  "scope_items",
                  "total_amount",
                  "payment_terms",
                ],
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
