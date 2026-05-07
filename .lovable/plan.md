## Objetivo

Garantir que **qualquer** request a `/api/public/*` retorne JSON (nunca o HTML do shell SPA), e expor a URL estável correta na tela de API Keys para que o Power BI nunca mais receba 302 → HTML.

---

## 1. Catch-all server route — `src/routes/api/public/$.ts` (novo)

Cria um server route splat que responde **JSON 404** para qualquer caminho não casado em `/api/public/*` (ex.: `bi-comerial`, `bi-comercial/`, `bi-comercial/foo`). Usa `jsonResponse()` do helper existente, então herda `Content-Type: application/json` + CORS.

```ts
import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, jsonResponse } from "@/lib/bi-auth.server";

function notFoundJson({ params }: { params: { _splat?: string } }) {
  return jsonResponse(
    {
      error: "Not found",
      path: `/api/public/${params._splat ?? ""}`,
      hint: "Available: bi-comercial, bi-financeiro, bi-operacao, bi-kpis-comercial, bi-kpis-financeiro, bi-kpis-operacao.",
    },
    404,
  );
}

export const Route = createFileRoute("/api/public/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: notFoundJson,
      POST: notFoundJson,
      PUT: notFoundJson,
      DELETE: notFoundJson,
      PATCH: notFoundJson,
    },
  },
});
```

Como TanStack Router prioriza rotas literais sobre splat, os 6 endpoints existentes continuam funcionando normalmente — o splat só atende caminhos não reconhecidos.

## 2. URL estável na tela de docs — `src/routes/_authenticated/admin_.api-keys.tsx`

Trocar a montagem dinâmica baseada em `window.location.origin` (que pode ser `id-preview--*.lovableproject.com` e exige login) por uma URL **estável de produção**:

```ts
// linha 38
const LOVABLE_PROJECT_ID = "cf53888c-5892-4d07-b039-dfe5e9ea2b47";
const FN_BASE = `https://project--${LOVABLE_PROJECT_ID}.lovable.app/api/public`;
```

Assim, todos os `curl` exibidos e a URL copiada pelo botão "Copy" usam o domínio estável que serve o build publicado, sem auth-bridge.

---

## Importante (fora do código)

O custom domain `ljmanager.fluxorbi.com` está servindo build antigo (404 HTML para `/api/public/bi-comercial`). **Após aplicar, é necessário clicar em Publish** para que o build com as rotas vá ao ar no domínio publicado / custom domain.

## Arquivos tocados

- `src/routes/api/public/$.ts` (novo)
- `src/routes/_authenticated/admin_.api-keys.tsx` (linha 38)

## Fora de escopo

- Mudar comportamento do redirect 302 do `*.lovableproject.com` (config do Lovable).
- Streaming / cursor pagination (já listado em planos anteriores).
