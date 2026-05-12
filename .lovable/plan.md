## Diagnóstico

Confirmei no banco o que está acontecendo:

**Lançamento bancário** (tela Conciliação)
- `Tarifa Renovação Cadastro` · 2022-08-25 · **−R$ 58,00** · `direction = NULL` · `conciliado`

**Match existente** (`conciliation_matches`, status `confirmado`)
- Aponta para o financial_entry **Bertrand Bonelli · R$ 3.000,00 entrada · 2026-04-30** ← pareamento errado (direção e valor diferentes).

**Lançamento financeiro correto** (tela Movimentação Financeira)
- `Talyson · Tarifa Renovação Cadastro · 2022-08-25 · −R$ 58,00 saída` · ainda **pendente** ← deveria ser este o par.

### Causa raiz

1. Lançamentos importados de **PDF** não preenchem `direction` em `bank_statement_entries` (o `parse-bank-statement-pdf` retorna só amount com sinal; o insert em `conciliacao.tsx` linha 165 grava `direction: t.direction` que vem `undefined` do PDF).
2. Sem `direction`, o `autoSuggest`/`suggestMatches` calcula `feAmount = amount_out` (fallback do ternário), não acha o Talyson e o usuário acaba parando no diálogo "Buscar" e pareando manualmente.
3. O `conciliatePair` aceita qualquer par sem validar se valor/sinal batem — por isso o par errado (R$ 3.000 entrada ↔ R$ 58 saída) foi confirmado sem aviso, e o Talyson ficou para trás como pendente.

## Correções propostas

### 1. Corrigir o dado atual (migração de dados)

- Apagar o match errado (`a486a6e8-0a6f-47bf-aa1a-e916f5879c42`).
- Reverter `financial_entries.Bertrand Bonelli` para `pendente`.
- Criar match correto entre o bank entry `9cd61c76…` e o financial entry `Talyson 0e75dabb…` com `status = confirmado`, `match_type = manual`.
- Marcar o financial entry do Talyson como `conciliado` (o bank entry já está).
- Preencher `direction` em todos os `bank_statement_entries` onde está `NULL`, derivando de `amount` (negativo → `saida`, positivo → `entrada`) e normalizar `amount` para valor absoluto se necessário.

### 2. Ajustar `src/routes/_authenticated/conciliacao.tsx`

- **Insert de bank entries (linha ~165):** quando `t.direction` vier vazio, derivar de `Math.sign(t.amount)`; gravar sempre `amount: Math.abs(t.amount)`.
- **`autoSuggest` e `suggestMatches`:** se `stmt.direction` for nulo, usar `amount > 0 ? amount_in : amount_out` baseado no sinal do `stmt.amount`.
- **`conciliatePair` (mutation de pareamento manual):** antes de confirmar, validar:
  - Direção do bank (`saida`/`entrada`, derivada se NULL) bate com o lado do financial entry (`amount_out > 0` vs `amount_in > 0`).
  - Diferença de valor < R$ 0,01.
  - Se não bater, abrir `AlertDialog` de confirmação ("Valores ou direção divergem — confirmar mesmo assim?") em vez de salvar silenciosamente. Se confirmar, marcar `conciliation_matches.status = 'sugerido'` ou criar com flag de divergência (manter `confirmado` mas o usuário viu o aviso).

### 3. (Opcional, se desejar) Ajustar o parser do PDF

- Em `supabase/functions/parse-bank-statement-pdf/index.ts`, adicionar instrução ao prompt para que cada `transaction.amount` venha **com sinal** e expor `direction` derivada — assim o front recebe direction direto. Pode ser feito depois; o item 2 já cobre o sintoma.

## Resumo técnico

- Migração de dados única para destravar o caso atual.
- 3 pequenas mudanças no `conciliacao.tsx` (derivar direction, suggest com fallback, validação no pareamento manual).
- Sem alteração de schema; sem alteração no Kanban/Devis.

Confirma que sigo com **(1) correção dos dados + (2) ajustes no front**? O item (3) do parser eu deixo de fora a menos que você peça.
