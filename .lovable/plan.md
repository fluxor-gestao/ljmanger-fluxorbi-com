## Problema

A proposta `DE202605001` foi validada (5/5 itens, "Validada em 11/05/2026"), mas:
- O **status** continua `rascunho` (legado)
- O botão **"Enviar ao cliente"** não aparece
- No **Kanban Comercial** ela também não está na coluna correta do fluxo

## Causa

1. A ação **Validar proposta** em `ValidationChecklist.tsx` apenas grava `validated_at`/`validated_by` — não move o status.
2. O botão de envio em `comercial_.devis.$id.tsx` (linha 228) só aparece quando `status === "pronta_para_envio"`. Como o status nunca avança, o botão nunca aparece.
3. Após o envio, aceite e geração de cobrança, o status também precisa progredir automaticamente para que cada cartão apareça na coluna certa do Kanban.

## Correção (status auto-andante + Kanban sincronizado)

Toda a transição de status passa a ser **automática**, disparada pelo evento de negócio. O Kanban Comercial já lê `devis.status` e renderiza por coluna — então basta garantir que o status seja atualizado em cada ponto do fluxo.

### Fluxo de status alvo

```text
rascunho / reuniao_realizada / proposta_em_geracao
        │  (usuário clica "Validar proposta")
        ▼
aguardando_validacao  →  pronta_para_envio
        │  (usuário clica "Enviar ao cliente" e e-mail é enviado)
        ▼
enviada_ao_cliente  →  aguardando_aceite
        │  (cliente clica "Aceitar Proposta" no link público)
        ▼
aceita
        │  (cobrança inicial 50% gerada no Financeiro)
        ▼
cobranca_pendente  →  entrada_recebida  (quando entrada é conciliada)
        │  (case operacional criado em Operação)
        ▼
enviado_para_operacao
```

Em qualquer ponto, se o cliente rejeitar → `rejeitada`.

### Mudanças por arquivo

1. **`src/components/devis/ValidationChecklist.tsx`**
   - Mutation `validate`: ao gravar `validated_at`/`validated_by`, também setar `status = "pronta_para_envio"` quando o status atual for um pré-envio (`rascunho`, `reuniao_realizada`, `proposta_em_geracao`, `aguardando_validacao`). Não tocar se já estiver em status pós-envio.
   - Mutation `invalidate`: se o status atual for `pronta_para_envio`, voltar para `aguardando_validacao`.

2. **`src/routes/_authenticated/comercial_.devis.$id.tsx`**
   - Trocar a condição do botão "Enviar ao cliente" (linha 228) por:
     ```ts
     const canSend =
       !!devis.validated_at &&
       ["pronta_para_envio", "rascunho", "reuniao_realizada", "proposta_em_geracao", "aguardando_validacao"]
         .includes(devis.status);
     ```
     Assim, propostas legadas (`rascunho`) que já passaram pela Validação Comercial também mostram o botão.

3. **`supabase/functions/send-devis-proposal/index.ts`**
   - Após o envio bem-sucedido do e-mail, atualizar o devis com `status = "aguardando_aceite"` e `sent_at = now()`. (Hoje provavelmente só grava `sent_at`.) Isso move o cartão no Kanban da coluna "Pronta para envio" → "Aguardando aceite".

4. **`src/routes/proposta.aceite.$token.tsx`**
   - Ao registrar o aceite do cliente (já grava `accepted_at`/`accepted_ip`), também setar `status = "aceita"`.
   - Manter o trigger/lógica existente que gera a cobrança inicial; logo após gerar a cobrança, atualizar `status = "cobranca_pendente"` (ou já dentro do mesmo update, conforme o fluxo atual do Financeiro).

5. **Conciliação (entrada recebida)** — `src/routes/_authenticated/conciliacao.tsx` (ou edge function correspondente):
   - Quando uma `financial_entry` vinculada à entrada do devis é conciliada, atualizar o devis correspondente para `status = "entrada_recebida"`.

6. **Criação do case operacional** — onde hoje a `services` é inserida a partir do devis aceito:
   - Após `INSERT` na tabela `services`, atualizar o devis para `status = "enviado_para_operacao"`.

### Kanban

Nenhuma mudança necessária em `DevisKanban.tsx` — ele já agrupa por `devis.status` usando `PIPELINE_STATUSES`. Como o status passa a refletir cada etapa, os cartões migram sozinhos entre as colunas. O drag-and-drop manual continua funcionando como override (ex.: marcar `rejeitada` manualmente).

### Bloqueio existente preservado

`requiresValidation()` em `src/lib/devisStatus.ts` continua impedindo movimentação manual no Kanban para colunas pós-envio sem validação — o que protege o fluxo automático contra "pular etapas".

## Arquivos alterados

- `src/components/devis/ValidationChecklist.tsx`
- `src/routes/_authenticated/comercial_.devis.$id.tsx`
- `src/routes/proposta.aceite.$token.tsx`
- `src/routes/_authenticated/conciliacao.tsx` (ponto de conciliação da entrada)
- `supabase/functions/send-devis-proposal/index.ts`
- (revisar) ponto de criação do `services` a partir do devis aceito

Sem mudanças de schema, RLS ou edge functions novas.