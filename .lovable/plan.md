## Objetivo

Trocar o envio do e-mail de proposta (devis) do remetente provisório `onboarding@resend.dev` (Resend) para o **Lovable Emails** usando o domínio `lundgaardjensen.com` (sub-remetente `notify.lundgaardjensen.com`), mantendo o mesmo HTML, CTA "Aceitar Proposta", anexo PDF e idioma (PT/FR/EN/ES).

## Passos

### 1. Configurar o domínio (você faz uma vez)

Vou abrir o diálogo de setup de e-mail. Você informa `lundgaardjensen.com` e o sistema vai gerar 2 registros NS (`notify.lundgaardjensen.com → ns3/ns4.lovable.cloud`) que você precisa adicionar no provedor de DNS do domínio. Não exige tocar nos registros MX/SPF/DKIM atuais do domínio — só delegamos o subdomínio `notify`.

DNS pode levar até 72h para propagar (geralmente minutos). O scaffolding e deploy podem ser feitos antes disso; o envio começa quando o DNS verificar.

### 2. Provisionar a infraestrutura de e-mail

Backend: filas pgmq, tabelas `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, RPCs `enqueue_email/...`, cron de processamento e server route `process-email-queue`. Tudo automático via tooling Lovable — sem migrações manuais.

### 3. Reescrever o envio da proposta (`src/components/devis/SendDevisDialog.tsx` + nova rota)

- Criar template React Email em `src/lib/email-templates/devis-proposal.tsx` reproduzindo o HTML atual do `send-devis-proposal/index.ts` (header LUNDGAARD JENSEN, faixa dourada, mensagem multi-idioma, botões verde "Aceitar" / "Recusar" linkando para `accept_url`, rodapé com endereço/contatos). I18N (`pt`/`fr`/`en`/`es`) preservado.
- Registrar em `src/lib/email-templates/registry.ts`.
- Criar server route autenticada `src/routes/api/send-devis-proposal.ts` (substitui a edge function) que:
  1. Valida JWT do usuário logado.
  2. Recebe `devis_id`, `to`, `subject`, `message_text`, `pdf_base64`, `pdf_filename`, `accept_url`, `client_name`, `devis_number`, `language`.
  3. Enfileira na fila transacional via `enqueue_email` com `templateData` (mensagem, link, idioma).
  4. Atualiza `devis.status = 'enviada_ao_cliente'` e `sent_at`.
- `SendDevisDialog.tsx`: trocar `supabase.functions.invoke("send-devis-proposal", ...)` por `fetch("/api/send-devis-proposal", ...)` com header Authorization. Resto (geração de PDF, UI) permanece.

> ⚠️ **Anexos PDF**: o pipeline de Lovable Emails **não suporta anexos nativamente**. Para preservar o PDF, vou subir o PDF gerado para um bucket Supabase Storage (`devis-pdfs`, privado) e gerar um link assinado (validade 30 dias) que entra no e-mail como botão "📎 Baixar Proposta (PDF)" abaixo do CTA verde. Isso melhora também a experiência mobile (alguns clientes recusam anexos).

### 4. Remover o aviso de "modo de teste do Resend"

Tirar o banner amarelo do `SendDevisDialog.tsx` (não se aplica mais).

### 5. Limpeza (depois que confirmar funcionando)

- Apagar `supabase/functions/send-devis-proposal/index.ts` e o bloco em `supabase/config.toml`.
- Remover o segredo `RESEND_API_KEY` (você pode manter se quiser reverter rapidamente).

## O que muda para o cliente final

- Remetente passa a ser `Lundgaard Jensen <noreply@lundgaardjensen.com>` (em vez de `onboarding@resend.dev`).
- Layout, idiomas e botão "Aceitar Proposta" idênticos.
- Anexo vira botão "Baixar Proposta (PDF)" no corpo do e-mail.
- Entregabilidade muito melhor (SPF/DKIM próprios, sem domínio compartilhado).
- Ganha rastreio: cada envio aparece em `email_send_log`, com retry automático em caso de falha temporária e supressão de bounces.

## Bloqueio na imagem do aceite (problema relatado antes)

Enquanto isso, esse caminho continua igual — a rota `/proposta/aceite/$token` e a edge function `accept-devis-proposal` permanecem, então o link no e-mail continua funcionando.

---

Confirma? Quando aprovar, vou abrir o diálogo de configuração do domínio e seguir do passo 1 ao 5 em sequência.
