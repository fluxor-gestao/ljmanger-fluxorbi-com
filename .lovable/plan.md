## Melhorar a "Estrutura da proposta" gerada pela IA

Analisando as imagens:

- **Imagem 1 (atual)**: estrutura curtinha — só I. Partes, II. Objeto (1 frase), lista A/B/C com 1 linha de descrição cada e **Montants = 0.00 BRL**.
- **Imagem 3 (atual, mais abaixo)**: confirma III. Honoraires com `Total des services: 0.00 BRL` e IV. Délai com 1 frase genérica.
- **Imagem 2 (primeira versão / referência)**: relatório bem mais denso, com contexto, métricas, pontos de dor, attentes, lista de tarefas com responsáveis e prazos — esse nível de detalhamento é o alvo para a proposta final, não só para o relatório de entrada.

Hoje a geração está em `supabase/functions/generate-devis-proposal/index.ts` (modelo `google/gemini-2.5-flash` com tool call `build_proposal`). Dois problemas práticos:

1. O prompt pede uma estrutura mínima, então o `proposal_structure` sai enxuto demais.
2. Quando o `total_amount` não é informado pelo usuário, a IA preenche `scope_items[].amount = 0` e o III. Honoraires fica todo zerado.

### Mudanças propostas

**1. Reescrever o `systemPrompt` e o `userPrompt`** para exigir uma proposta formal completa, com estas seções obrigatórias no `proposal_structure` (markdown):

```text
# {Título}
## I.   Identification des Parties        (Prestataire + Client)
## II.  Contexte et Objet du Contrat      (2–4 parágrafos: contexto da reunião,
                                           problema do cliente, objetivo)
### Étendue des Services                   (lista A) B) C)… com, para cada item:
                                           • Descrição detalhada (3–6 linhas)
                                           • Entregáveis concretos
                                           • Partes envolvidas
                                           • Métricas / indicadores de sucesso
                                           • Prazo estimado da etapa
                                           • Montant (BRL)
## III. Honoraires                         (Total, entrada 50%, saldo 50%,
                                           condições de pagamento, reajustes)
## IV.  Délai et Calendrier                (cronograma por fase, marcos)
## V.   Obligations des Parties            (curto: prestataire e cliente)
## VI.  Confidentialité et Propriété       (curto, padrão jurídico)
## VII. Dispositions Finales               (foro, rescisão, vigência)
```

Instruções adicionais no system prompt:
- Tom formal jurídico, no idioma detectado, sem misturar idiomas.
- Cada item de escopo deve ter pelo menos 3 frases descritivas + entregáveis em bullets.
- Reutilizar fatos do `meeting_report` (pontos de dor, attentes, partes, prazos) para personalizar a proposta — não escrever genérico.
- Nunca usar placeholders como "[Insérer le lieu]" — se faltar dado, omitir a linha.

**2. Ajustar distribuição de valores nos `scope_items`:**

- Se o usuário **informou** `total_amount`: a IA deve distribuir esse valor entre os `scope_items` proporcionalmente ao esforço estimado de cada item (soma dos `amount` = `total_amount`), nunca deixar 0.
- Se o usuário **não informou**: a IA deve **estimar** um valor de mercado plausível por item com base no escopo (em BRL), e o `total_amount` retornado vira a soma. Adicionar no prompt uma faixa de referência por tipo de serviço jurídico (ex.: due diligence imobiliária, constituição de sociedade, acompanhamento urbanístico) para a estimativa não sair fora da realidade.
- Marcar `amount` como `required` no schema da tool e instruir que valores zero são proibidos.

**3. Enriquecer o schema da tool `build_proposal`** com campos opcionais que ajudam a IA a estruturar antes de escrever o markdown — e que podem ser úteis no futuro mesmo que hoje só usemos o `proposal_structure`:

```text
deliverables[]            string  (lista global de entregáveis)
milestones[]              { label, date }
payment_terms             string  (texto da condição de pagamento)
assumptions[]             string  (premissas e exclusões)
```

Isso força o modelo a "pensar" nesses pontos antes de redigir o texto final.

**4. Aumentar `max_tokens` implicitamente** trocando para um prompt que peça resposta longa; manter `google/gemini-2.5-flash` (já é o modelo padrão recomendado para texto longo barato). Sem mudança de modelo necessária.

### O que NÃO muda

- Botão "Gerar proposta automaticamente" e seu lugar no formulário.
- Bloco `AISuggestionsBlock` (aceitar campo a campo / aceitar tudo / descartar) continua igual.
- Render do PDF (`DevisPdfTemplate.tsx`) — ele já sabe parsear os itens A) B) C) do markdown e mostrar valores; vai automaticamente ficar mais rico quando a IA gerar mais conteúdo.
- Schema do banco de dados — nada muda.
- Outras telas (Comercial, Financeiro, etc.) — intocadas.

### Arquivo afetado

- `supabase/functions/generate-devis-proposal/index.ts` (única alteração)

### Validação após implementar

1. Abrir um devis com `meeting_report` preenchido, clicar em "Gerar proposta automaticamente".
2. Conferir que `proposal_structure` agora contém as 7 seções, descrições longas por item e **valores ≠ 0**.
3. Exportar PDF e validar que os cards A) B) C) aparecem com os valores corretos e o total bate.
