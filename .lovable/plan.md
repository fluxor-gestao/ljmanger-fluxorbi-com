## Diagnóstico

**Problema 1 — "Erro de conexão" ao abrir o aceite**

A página `/proposta/aceite/$token` chama a edge function `accept-devis-proposal` (GET para carregar a proposta, POST para aceitar/recusar). Essa função **não existe** no projeto:

```
supabase/functions/
├── analyze-meeting-report
├── generate-devis-proposal
├── manage-users
├── parse-bank-statement-pdf
└── send-devis-proposal      ← só tem o envio, não tem o aceite
```

Por isso o `fetch` falha e cai no `catch` mostrando "Erro de conexão". Precisa criar a função.

**Problema 2 — E-mail enviado está sem a identidade visual antiga**

O template HTML atual em `send-devis-proposal/index.ts` é minimalista: só o texto com `white-space:pre-wrap` + um botão azul "Aceitar Proposta". Falta tudo o que aparece no modelo antigo (imagem 2):
- Cabeçalho **LUNDGAARD JENSEN / ADVOCACIA & CONSULTORIA INTERNACIONAL** com linha dourada divisória
- Texto guia "Você pode aceitar ou recusar a proposta clicando nos botões abaixo"
- **Dois botões lado a lado**: "Aceitar Proposta" (verde) e "Recusar" (branco com borda vermelha)
- Rodapé com endereço, telefones, site e Instagram

## Correção

### 1. Criar `supabase/functions/accept-devis-proposal/index.ts`

Edge function pública (sem JWT) que:

- **GET `?token=...`** → busca a `devis` pelo `accept_token`, devolve preview JSON (`title`, `client_name`, `total_amount`, `down_payment_amount`, `deadline_date`, `scope_description`, `proposal_structure`, `accepted_at`, `rejected_at`). 404 se não achar.
- **POST `?token=...`** → marca `accepted_at = now()`, `status = 'aceita'`, e devolve o mesmo preview atualizado. Idempotente (se já aceito, retorna estado atual sem alterar).
- **POST `?token=...&action=reject`** com body `{ reason }` → marca `rejected_at = now()`, `status = 'recusada'`, salva motivo em `rejection_reason` (ou similar — confirmar no schema). Idempotente.
- Headers CORS completos (incluindo `OPTIONS`).
- Usa `SERVICE_ROLE_KEY` para bypass de RLS.
- Adicionar `verify_jwt = false` em `supabase/config.toml` para esta função.

### 2. Refazer o HTML em `supabase/functions/send-devis-proposal/index.ts`

Substituir o `htmlBody` por um template no molde da imagem 2:

```text
┌──────────────────────────────────────┐
│ LUNDGAARD JENSEN                     │
│ ADVOCACIA & CONSULTORIA INTERNACIONAL│
│ ────────────────────────  (dourado)  │
│                                      │
│ {mensagem em pre-wrap}               │
│                                      │
│ Você pode aceitar ou recusar a       │
│ proposta clicando nos botões abaixo. │
│                                      │
│  [Aceitar Proposta]  [Recusar]       │
│   verde sólido        borda vermelha │
│                                      │
│ ──────────────────────────────────── │
│ Rua João Cordeiro, 831 — Iracema     │
│ +55 (85) 9 9406-6042 | 9 3037-9931   │
│ lundgaardjensen.com | @lundgaard...  │
└──────────────────────────────────────┘
```

- O botão "Recusar" aponta para `${accept_url}?action=reject` (a página `/proposta/aceite/$token` já trata o estado de recusa via diálogo, mas o link direto também precisa funcionar — alternativa: ambos os botões vão para o mesmo `accept_url` e a página mostra os dois CTAs, igual já está hoje). **Recomendado**: manter os dois botões apontando para `accept_url` e deixar a página decidir, porque ela já tem fluxo completo de aceite + recusa com motivo.
- Textos do cabeçalho/CTA traduzidos conforme `language` (pt/fr/en/es) recebido no payload (já é enviado pelo client).
- Mantém o anexo PDF e o `update` para `enviada_ao_cliente` exatamente como hoje.

### 3. Sem alterações no frontend

O `proposta.aceite.$token.tsx` já está correto — só precisa que a função exista.

## Arquivos alterados

- **Novo**: `supabase/functions/accept-devis-proposal/index.ts`
- **Editado**: `supabase/functions/send-devis-proposal/index.ts` (apenas o `htmlBody`)
- **Editado**: `supabase/config.toml` (adicionar bloco `[functions.accept-devis-proposal] verify_jwt = false`)
