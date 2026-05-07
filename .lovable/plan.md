## Objetivo

Substituir o placeholder do dashboard **Comercial** em `/bi` por um iframe que carrega o relatório Power BI publicado.

## Mudança — `src/routes/_authenticated/bi.tsx`

1. Adicionar campo opcional `embedUrl` em cada item de `dashboards`. Apenas o `comercial` recebe a URL agora:

```ts
{
  id: "comercial",
  title: "Dashboard Comercial",
  icon: ShoppingCart,
  gradient: "from-purple-500 to-purple-700",
  embedUrl:
    "https://app.powerbi.com/view?r=eyJrIjoiMDk0YTI0NmQtOTdjNC00ZGY1LTgyOTQtZjg0ZmZkNzY0MTE1IiwidCI6ImViYzMxZTJiLWE5OTYtNGQ4MS04NzIwLWRjNWNkYWQ4YzNmYyJ9",
}
```

2. No `CardContent` do dashboard ativo, quando `activeDashboard.embedUrl` existir, renderizar:

```tsx
<iframe
  title={activeDashboard.title}
  src={activeDashboard.embedUrl}
  className="h-[75vh] w-full border-0"
  allowFullScreen
/>
```

Caso contrário, manter o placeholder atual (Financeiro e Operação continuam como estão até receberem suas URLs).

## Fora de escopo

- URLs de Financeiro e Operação (adicionar quando você enviar).
- Auth/RLS no Power BI (o link `view?r=...` é público por design da Microsoft).
