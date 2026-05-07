## Objetivo

Criar endpoints REST públicos (sem login) para conectar Power BI / Looker / Metabase aos dados do sistema, autenticados apenas por um `?token=` na URL. Adicionar a gestão dessas chaves (criar / revogar / copiar URL pronta) na página **Opções / Usuários** (`/admin`).

## O que será feito

### 1. Endpoints públicos (server routes em `src/routes/api/public/`)

Criar 7 rotas, todas em `GET`, todas em `/api/public/bi-*`, autenticadas via `?token=lk_xxx`:

| Rota | Conteúdo | Escopo |
|---|---|---|
| `/api/public/bi-comercial` | Lista de devis (paginado) | comercial |
| `/api/public/bi-financeiro` | Lançamentos financeiros (paginado) | financeiro |
| `/api/public/bi-financeiro?dataset=bank_statement` | Extrato bancário | financeiro |
| `/api/public/bi-operacao` | Serviços | operacao |
| `/api/public/bi-kpis-comercial` | KPIs agregados (totais, conversão, ticket médio) | comercial |
| `/api/public/bi-kpis-financeiro` | Receita, despesa, saldo por mês | financeiro |
| `/api/public/bi-kpis-operacao` | Status de serviços, prazos | operacao |

Todas seguem o mesmo padrão:

1. Lê `?token=` da URL.
2. Calcula SHA-256 do token e chama `validate_api_key(_key_hash)` (função já existente no banco). Se inválido → 401.
3. Confere se o escopo da rota está em `scopes[]` da chave → se não, 403.
4. Lê `from`, `to`, `page`, `page_size` (máx 1000) da query.
5. Usa `supabaseAdmin` (server-only) para consultar a tabela e retornar `{ data, meta: { page, page_size, total } }`.
6. CORS aberto (`Access-Control-Allow-Origin: *`) para o Power BI conseguir conectar.

A função `validate_api_key` já incrementa `usage_count` e `last_used_at` automaticamente.

### 2. Atualizar a tela de gestão de chaves

A tela `admin.api-keys.tsx` já existe e já cria/revoga chaves (essa parte fica). Vamos só:

- Trocar a URL base exibida na aba "Documentação" de `https://{project}.functions.supabase.co` para a URL real da app (`window.location.origin`).
- Trocar os exemplos de `header x-api-key` para `?token=...` na URL.
- Adicionar um botão **"Copiar URL pronta"** ao lado de cada endpoint na documentação, que copia algo como:
  ```
  https://ljmanager.fluxorbi.com/api/public/bi-financeiro?token=lk_xxx&from=2026-01-01&to=2026-12-31
  ```
- Aviso visível: **"Qualquer pessoa com este link consegue baixar os dados. Compartilhe apenas com a ferramenta de BI."**

### 3. Integração na página Opções / Usuários

A página `/admin` já tem um botão **"API Keys (BI)"** no canto superior direito que vai para `/admin/api-keys`. Manter exatamente como está — atende o pedido do usuário.

## Detalhes técnicos

- Server routes ficam em `src/routes/api/public/bi-comercial.ts`, etc. (padrão TanStack Start, já documentado no projeto).
- Usam `supabaseAdmin` de `@/integrations/supabase/client.server` (bypassa RLS — necessário, pois a request não tem usuário logado; a autorização é feita pela API key).
- Hash do token é feito com `crypto.subtle.digest('SHA-256', ...)` usando `Web Crypto API` (disponível no runtime Worker).
- Limite de `page_size` é 1000 para respeitar o teto padrão do Supabase.
- Erros retornam JSON: `{ error: "...", code: 401 }`.

## Nada disso muda

- Schema do banco (tabela `api_keys` e função `validate_api_key` já existem).
- Tela `/bi` (dashboards internos).
- Edge functions atuais.
- RLS de nenhuma tabela.

## Riscos

- Token na URL aparece em logs de proxy/CDN. Mitigação: aviso na tela + botão "revogar" sempre visível.
- `supabaseAdmin` bypassa RLS. Mitigação: cada rota só responde a um escopo específico e só após validar a chave.
