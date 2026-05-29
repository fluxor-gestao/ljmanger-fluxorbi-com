// Gera estrutura de proposta (Devis) a partir de um relatório de reunião usando Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "pt" | "fr" | "en" | "es";

// Cabeçalhos e labels nativos por idioma — SEM bilíngue, SEM barras "/"
const STRUCTURE: Record<Lang, {
  langName: string;
  title: string;
  sec1: string; provider: string; client: string;
  sec2: string;
  scope: string;
  lblDesc: string; lblDeliv: string; lblParties: string; lblMetrics: string; lblDuration: string;
  sec3: string;
  lblTotal: string; lblDown: string; lblBalance: string;
  sec4: string;
  sec5: string;
  sec6: string;
  sec7: string;
  forbidden: string[];
}> = {
  pt: {
    langName: "português do Brasil",
    title: "Título da proposta",
    sec1: "I. Identificação das Partes",
    provider: "CONTRATADO",
    client: "CONTRATANTE",
    sec2: "II. Contexto e Objeto do Contrato",
    scope: "Escopo de Serviços",
    lblDesc: "Descrição", lblDeliv: "Entregáveis", lblParties: "Partes envolvidas",
    lblMetrics: "Indicadores de sucesso", lblDuration: "Prazo",
    sec3: "III. Honorários",
    lblTotal: "Total", lblDown: "Entrada de 50%", lblBalance: "Saldo de 50%",
    sec4: "IV. Prazo e Cronograma",
    sec5: "V. Obrigações das Partes",
    sec6: "VI. Confidencialidade e Propriedade Intelectual",
    sec7: "VII. Disposições Finais",
    forbidden: ["PRESTATAIRE", "CLIENT :", "Identification des Parties", "Contexte et Objet", "Étendue des Services", "Description :", "Livrables", "Parties prenantes", "Indicateurs de succès", "Délai", "Honoraires", "Calendrier", "Obligations des Parties", "Confidentialité", "Dispositions Finales", "attentes"],
  },
  fr: {
    langName: "français",
    title: "Titre de la proposition",
    sec1: "I. Identification des Parties",
    provider: "PRESTATAIRE",
    client: "CLIENT",
    sec2: "II. Contexte et Objet du Contrat",
    scope: "Étendue des Services",
    lblDesc: "Description", lblDeliv: "Livrables", lblParties: "Parties prenantes",
    lblMetrics: "Indicateurs de succès", lblDuration: "Délai",
    sec3: "III. Honoraires",
    lblTotal: "Total", lblDown: "Acompte de 50%", lblBalance: "Solde de 50%",
    sec4: "IV. Délai et Calendrier",
    sec5: "V. Obligations des Parties",
    sec6: "VI. Confidentialité et Propriété Intellectuelle",
    sec7: "VII. Dispositions Finales",
    forbidden: ["CONTRATADO", "CONTRATANTE", "Identificação das Partes", "Escopo de Serviços", "Honorários", "Cronograma", "Obrigações", "Confidencialidade", "Disposições Finais"],
  },
  en: {
    langName: "English",
    title: "Proposal Title",
    sec1: "I. Identification of the Parties",
    provider: "PROVIDER",
    client: "CLIENT",
    sec2: "II. Background and Purpose of the Agreement",
    scope: "Scope of Services",
    lblDesc: "Description", lblDeliv: "Deliverables", lblParties: "Stakeholders",
    lblMetrics: "Success indicators", lblDuration: "Timeframe",
    sec3: "III. Fees",
    lblTotal: "Total", lblDown: "50% Down Payment", lblBalance: "50% Final Balance",
    sec4: "IV. Timeline and Schedule",
    sec5: "V. Obligations of the Parties",
    sec6: "VI. Confidentiality and Intellectual Property",
    sec7: "VII. Final Provisions",
    forbidden: ["PRESTATAIRE", "CONTRATADO", "CONTRATANTE", "Honoraires", "Honorários", "Délai", "Livrables", "Description :", "Étendue", "attentes", "Escopo"],
  },
  es: {
    langName: "español",
    title: "Título de la propuesta",
    sec1: "I. Identificación de las Partes",
    provider: "PRESTADOR",
    client: "CLIENTE",
    sec2: "II. Contexto y Objeto del Contrato",
    scope: "Alcance de los Servicios",
    lblDesc: "Descripción", lblDeliv: "Entregables", lblParties: "Partes involucradas",
    lblMetrics: "Indicadores de éxito", lblDuration: "Plazo",
    sec3: "III. Honorarios",
    lblTotal: "Total", lblDown: "Anticipo del 50%", lblBalance: "Saldo del 50%",
    sec4: "IV. Plazo y Cronograma",
    sec5: "V. Obligaciones de las Partes",
    sec6: "VI. Confidencialidad y Propiedad Intelectual",
    sec7: "VII. Disposiciones Finales",
    forbidden: ["PRESTATAIRE", "CONTRATADO", "Honoraires", "Honorários", "Livrables", "Délai", "Étendue", "Escopo", "attentes"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { meeting_report, client_name, total_amount, language, tier } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");
    if (!meeting_report) throw new Error("meeting_report é obrigatório");

    const lang: Lang = (["pt", "fr", "en", "es"].includes(language) ? language : "pt") as Lang;
    const S = STRUCTURE[lang];

    // Tier de qualidade: 'final' usa gpt-5 (refinamento de proposta enviada ao cliente),
    // 'draft' (padrão) usa gpt-5-mini para a primeira geração.
    const model = tier === "final" ? "gpt-5" : "gpt-5-mini";

    const hasTotal = typeof total_amount === "number" && total_amount > 0;

    const systemPrompt = `Você é um advogado sênior redator de propostas comerciais jurídicas (devis), multilíngue. Escreva uma proposta FORMAL, COMPLETA e DETALHADA, 100% em ${S.langName}, sem misturar idiomas. Não traduza nomes próprios, valores monetários, datas, números ou siglas.

REGRA CRÍTICA DE IDIOMA:
- TODO o conteúdo (títulos de seção, labels de campo, corpo do texto) DEVE estar exclusivamente em ${S.langName}.
- PROIBIDO usar versões bilíngues, barras "/" separando idiomas, ou qualquer palavra/expressão dos seguintes idiomas estrangeiros: ${S.forbidden.join(", ")}.
- Use EXATAMENTE os títulos e labels fornecidos abaixo — não invente variantes, não adicione tradução entre parênteses.

REGRAS DE CONTEÚDO:
- Personalize a proposta usando fatos concretos do relatório da reunião: contexto, partes envolvidas, pontos de dor, expectativas, prazos, métricas, riscos. NUNCA escreva texto genérico.
- NUNCA use placeholders entre colchetes do tipo "[Inserir cliente]", "[XXX]". Se um dado não estiver disponível, simplesmente omita a linha.
- Tom formal jurídico, parágrafos bem construídos (não bullets soltos no texto corrido).

ESTRUTURA OBRIGATÓRIA DO CAMPO proposal_structure (Markdown, nesta ordem, com os títulos EXATOS abaixo em ${S.langName}):

# {${S.title}}

## ${S.sec1}
- **${S.provider}:** Lundgaard Jensen Advocacia e Consultoria Internacional
- **${S.client}:** {nome do cliente e demais dados disponíveis}

## ${S.sec2}
2 a 4 parágrafos densos descrevendo: (a) o contexto da reunião e situação atual do cliente, (b) o problema/desafio identificado, (c) o objetivo geral da contratação, (d) o resultado esperado. Citar fatos específicos do relatório.

### ${S.scope}
Lista A) B) C)... (no mínimo 3, idealmente 4–6 itens). Para CADA item siga EXATAMENTE este formato (labels em ${S.langName}):

**A) Título do serviço — BRL VALOR**
*${S.lblDesc}:* 3 a 6 frases descrevendo o serviço em profundidade, com base no relatório.
*${S.lblDeliv}:* lista curta dos entregáveis concretos (documentos, pareceres, atos).
*${S.lblParties}:* quem participa (cliente, escritório, notário, arquiteto, etc.).
*${S.lblMetrics}:* critérios mensuráveis de conclusão.
*${S.lblDuration}:* prazo estimado dessa etapa.

## ${S.sec3}
- Detalhar o **${S.lblTotal}** dos serviços (deve bater EXATAMENTE com a soma dos itens A+B+C+...).
- **${S.lblDown}** na assinatura: valor em BRL.
- **${S.lblBalance}** na conclusão: valor em BRL.
- Condições de pagamento, forma (PIX/transferência), prazo de pagamento das parcelas.
- Cláusula curta de reajuste por IPCA caso a execução ultrapasse 12 meses.

## ${S.sec4}
Cronograma por fase, com marcos (kickoff, entregas intermediárias, encerramento). Datas relativas (ex.: "D+15", "D+30") quando não houver datas fixas no relatório.

## ${S.sec5}
Parágrafo curto descrevendo obrigações do prestador (diligência, confidencialidade, relatórios periódicos) e do cliente (fornecer documentos, decisões tempestivas, pagamento).

## ${S.sec6}
Parágrafo padrão jurídico (sigilo, NDA implícito, titularidade dos pareceres permanecendo do prestador com licença de uso ao cliente).

## ${S.sec7}
Foro de eleição (Fortaleza/CE, salvo indicação em contrário no relatório), rescisão por inadimplemento, vigência até a conclusão dos serviços ou 12 meses (o que ocorrer primeiro).

REGRAS DE VALORES (CRÍTICAS):
${
  hasTotal
    ? `- O cliente já definiu um VALOR TOTAL de R$ ${total_amount}. Distribua esse valor entre os itens de escopo proporcionalmente ao esforço de cada um. A soma dos amounts dos scope_items DEVE ser EXATAMENTE ${total_amount}. total_amount no retorno = ${total_amount}.`
    : `- O cliente NÃO informou valor total. Você DEVE ESTIMAR valores de mercado brasileiros plausíveis para cada item de escopo (em BRL), considerando complexidade jurídica. Faixas de referência (BRL):
  • Due diligence imobiliária completa: 15.000 a 60.000
  • Constituição de sociedade (LTDA/SA) com aditivo: 8.000 a 25.000
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
Gere a proposta jurídica completa em ${S.langName}, seguindo TODAS as seções obrigatórias (I a VII) com os títulos e labels EXATOS fornecidos. Não use bilíngue, não use barras, não misture idiomas. Personalize tudo com base no relatório acima.`;

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
                      "Texto Markdown COMPLETO da proposta, contendo OBRIGATORIAMENTE as 7 seções I a VII conforme instruído, 100% no idioma alvo, SEM bilíngue, SEM barras. Mínimo ~2500 caracteres.",
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
