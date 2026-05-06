## Problema

Os cliques nas linhas da tabela de Devis (e no botão "olho") não abrem o detalhe porque a navegação está sendo feita interpolando o ID direto na string da URL:

```ts
navigate({ to: `/comercial/devis/${d.id}` })
```

O TanStack Router exige rotas dinâmicas com `params` separados — interpolar em template string quebra a resolução do path com `$id` e a navegação falha silenciosamente. (Por isso a URL atual `/comercial/devis/e15d0371...` que você vê foi possivelmente aberta por outro caminho — o Kanban usa o mesmo padrão errado e também está afetado.)

## Correção

Trocar todos os `navigate` e usos análogos para o formato type-safe:

```ts
navigate({ to: "/comercial/devis/$id", params: { id: d.id } })
```

### Arquivos a alterar

1. **`src/routes/_authenticated/comercial.tsx`** (linhas 605 e 613) — clique na linha e botão de ação na tabela de Devis.
2. **`src/components/devis/DevisKanban.tsx`** (linha 121) — clique nos cards do Kanban.

Sem mudanças de schema, sem mudanças de UI — apenas ajuste de chamadas de navegação.