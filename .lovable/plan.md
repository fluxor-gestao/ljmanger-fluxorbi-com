## Problema

Ao clicar em "Analisar com IA" no Upload de Relatório/Ata, aparece o erro:
`Cannot read properties of undefined (reading 'client')`

## Causa

A edge function `supabase/functions/analyze-meeting-report/index.ts` retorna o resultado como `{ payload }`:

```ts
return new Response(JSON.stringify({ payload }), ...)
```

Mas o frontend em `src/components/devis/UploadAtaDialog.tsx` (linha 149) lê o campo errado:

```ts
const p = data.data as AnalyzedPayload;  // ❌ data.data é undefined
setEditClient(p.client);                  // 💥 crash aqui
```

## Correção (1 linha)

Em `src/components/devis/UploadAtaDialog.tsx`, linha 149:

```ts
const p = data.payload as AnalyzedPayload;
```

Nenhuma outra alteração é necessária — o restante do fluxo (matches, edição de cliente, criação do devis) já espera o objeto `AnalyzedPayload` correto.

## Arquivos alterados

- `src/components/devis/UploadAtaDialog.tsx` (1 linha)
