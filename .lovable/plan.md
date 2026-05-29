# Diagnóstico — Tradução da Proposta + Substituição da IA

## Parte 1 — Por que a proposta em português aparece com francês

**Não é a IA que está "errando" a tradução.** O problema está no **system prompt** de `supabase/functions/generate-devis-proposal/index.ts`. Ele instrui o modelo a montar a estrutura **sempre** com cabeçalhos e labels bilíngues em francês, independentemente do idioma escolhido:

```
## I. Identification des Parties / Identificação das Partes
- **PRESTATAIRE / CONTRATADO:** ...
- **CLIENT / CONTRATANTE:** ...
## II. Contexte et Objet du Contrat
### Étendue des Services / Escopo de Serviços
**A) ... — VALOR BRL**
*Description :* ... *Livrables :* ... *Parties prenantes :* ...
*Indicateurs de succès :* ... *Délai :* ...
## III. Honoraires / Honorários
## IV. Délai et Calendrier
## V. Obligations des Parties
## VI. Confidentialité et Propriété Intellectuelle
## VII. Dispositions Finales
```

Mesmo dizendo "100% em {langName}, sem misturar idiomas", o template literal acima **já contém o francês fixo**, então o modelo replica. Resultado: PT com seções em FR (exatamente o que aparece no print do cliente). EN e ES sofrem do mesmo problema.

A função `translate-devis` (tradução pós-geração) não resolve porque ela traduz os campos do devis já salvos, mas a estrutura inicial **nasce bilíngue** — o cliente vê PT misturado antes de qualquer "traduzir".

Observação secundária: a palavra "attentes" aparece dentro das instruções em PT — vazamento menor, não chega ao output, mas mostra que o prompt foi escrito em modo bilíngue.

### Correção (Bloco A — só prompt, sem mudar de IA)

1. Em `generate-devis-proposal/index.ts`, separar **um conjunto de cabeçalhos por idioma** (PT / FR / EN / ES) e injetar no system prompt apenas o conjunto do `lang` escolhido. Exemplo PT:

```
## I. Identificação das Partes
- **CONTRATADO:** Lundgaard Jensen ...
- **CONTRATANTE:** {cliente}
## II. Contexto e Objeto do Contrato
### Escopo de Serviços
**A) Título — BRL X**
*Descrição:* ... *Entregáveis:* ... *Partes envolvidas:* ...
*Indicadores de sucesso:* ... *Prazo:* ...
## III. Honorários
## IV. Prazo e Cronograma
## V. Obrigações das Partes
## VI. Confidencialidade e Propriedade Intelectual
## VII. Disposições Finais
```
E equivalentes nativos em FR, EN, ES (sem "/" bilíngue).

2. Reforçar regra anti-mistura: "Use **somente** os títulos abaixo, sem versão bilíngue, sem barras `/`, sem palavras de outros idiomas (proibido: PRESTATAIRE, Description :, Livrables :, Délai :, Honoraires quando lang≠fr…)."

3. Eliminar palavras-soltas FR no corpo das instruções (`attentes` → `expectativas` etc.).

4. `translate-devis` segue intacta (continua útil para trocar idioma no preview depois).

**Impacto Bloco A:** apenas `supabase/functions/generate-devis-proposal/index.ts`. Sem schema, sem RLS, sem layout. Devis já gerados não mudam — regerar manualmente quem precisar.

---

## Parte 2 — Substituir a IA atual pela chave OpenAI do cliente

### Como está hoje

Toda IA passa pelo **Lovable AI Gateway** (`ai.gateway.lovable.dev`) usando `LOVABLE_API_KEY`. Quatro funções:

| Função | Modelo atual | Uso |
|---|---|---|
| `generate-devis-proposal` | `google/gemini-2.5-flash` (tool calling) | Gera a proposta |
| `translate-devis` | `google/gemini-2.5-flash` (JSON mode) | Traduz proposta |
| `analyze-meeting-report` | `google/gemini-2.5-flash` | Analisa ata de reunião |
| `parse-bank-statement-pdf` | `google/gemini-2.5-flash` (visão) | Lê PDF de extrato bancário |

### Estratégia de modelos OpenAI (definida pelo cliente)

> **Regra geral: processar tudo com `gpt-5-mini`. Refinar apenas os documentos mais importantes com `gpt-5`.**

Mapeamento por função:

| Função | Modelo padrão | Quando usa `gpt-5` (refinamento) |
|---|---|---|
| `analyze-meeting-report` | `gpt-5-mini` | Nunca (passo intermediário, alto volume) |
| `translate-devis` | `gpt-5-mini` | Nunca (tradução é mecânica) |
| `parse-bank-statement-pdf` | `gpt-5-mini` (com visão) | Nunca (extração estruturada) |
| `generate-devis-proposal` | `gpt-5-mini` na primeira geração | **`gpt-5` ao gerar a versão final da proposta** que será enviada ao cliente — documento mais sensível |

**Como implementar o "refinamento":**

- `generate-devis-proposal` passa a aceitar um parâmetro opcional `tier: 'draft' | 'final'` no body.
  - `'draft'` (padrão) → `gpt-5-mini` — usado no clique inicial "Gerar proposta com IA".
  - `'final'` → `gpt-5` — usado num novo botão "Refinar com GPT-5" ao lado, OU disparado automaticamente quando o usuário clica "Enviar proposta ao cliente" (a definir no momento da implementação).
- O frontend (`comercial_.devis.$id.tsx`) ganha o segundo botão. Sem mudar layout drasticamente — apenas um botão secundário ao lado do atual.
- Fallback: se `gpt-5` falhar (rate limit/erro), avisa o usuário e mantém a versão draft salva.

### Mudanças técnicas em cada função

Para cada uma das 4 funções:
- URL: `https://ai.gateway.lovable.dev/v1/chat/completions` → `https://api.openai.com/v1/chat/completions`
- Header: `Authorization: Bearer ${LOVABLE_API_KEY}` → `Authorization: Bearer ${OPENAI_API_KEY}`
- Modelo: `google/gemini-2.5-flash` → `gpt-5-mini` (ou `gpt-5` quando `tier==='final'` em `generate-devis-proposal`)
- Manter `tools` / `tool_choice` e `response_format: { type: "json_object" }` (compatíveis com OpenAI).
- Tratamento de erros HTTP da OpenAI: 401 (chave inválida), 429 (rate limit), 400 (validação), 500 (upstream).
- `parse-bank-statement-pdf` continua usando visão (`gpt-5-mini` suporta input de imagem; PDF precisa ser convertido em imagens página a página, ou enviado via Files API — validar no momento da implementação).

### Nova secret necessária

- `OPENAI_API_KEY` — pedida via tool de secrets (você cola o valor numa janela segura, não compartilha no chat).

### Trade-offs aceitos

- Sai do Lovable AI Gateway → perde observabilidade unificada e fallback automático do gateway.
- Custos passam a ser cobrados direto na sua conta OpenAI (era esse o objetivo).
- Rate limits agora são os da sua conta OpenAI — `gpt-5` tem TPM mais restrito que `gpt-5-mini`, daí a estratégia de só usar `gpt-5` no refinamento final.

---

## Ordem de execução proposta

1. **Bloco A — Tradução (não depende da IA escolhida):** corrigir cabeçalhos bilíngues em `generate-devis-proposal` → reportar.
2. **Bloco B1 — Secret:** adicionar `OPENAI_API_KEY` (interação tua).
3. **Bloco B2 — Migrar funções "high-volume" para OpenAI `gpt-5-mini`:** `analyze-meeting-report`, `translate-devis`, `parse-bank-statement-pdf` → testar cada uma → reportar.
4. **Bloco B3 — `generate-devis-proposal` com tiering:** `gpt-5-mini` no draft + botão "Refinar com GPT-5" usando `gpt-5` → testar → reportar.

Sem mudanças de RLS, matriz de papéis, regras de negócio ou layout além do botão extra de refinamento.

## Arquivos que serão tocados

- Bloco A: `supabase/functions/generate-devis-proposal/index.ts` (prompt).
- Bloco B2: `supabase/functions/{analyze-meeting-report,translate-devis,parse-bank-statement-pdf}/index.ts` (URL + header + modelo + erros).
- Bloco B3: `supabase/functions/generate-devis-proposal/index.ts` (parâmetro `tier` + modelo dinâmico) + `src/routes/_authenticated/comercial_.devis.$id.tsx` (botão "Refinar com GPT-5").
- Nova secret: `OPENAI_API_KEY`.

## Confirmar antes de implementar

1. Aplico já o **Bloco A** (cabeçalhos por idioma)?
2. Para o **Bloco B3**, prefere que `gpt-5` seja disparado por **botão manual** ("Refinar com GPT-5") ou **automaticamente** ao clicar "Enviar ao cliente"?
3. Posso pedir a secret `OPENAI_API_KEY` agora?
