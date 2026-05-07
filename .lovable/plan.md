## Mudanças

### 1. `src/lib/bi-auth.server.ts`
- Adicionar suporte a `?all=true` no `validateBiRequest` (novo campo `all: boolean` no retorno).
- Adicionar helper `fetchAll()` que itera em chunks de 1000 linhas até esgotar (cap de segurança: 200.000 linhas).

### 2. Endpoints de dados brutos (`bi-comercial`, `bi-financeiro`, `bi-operacao`)
- Quando `?all=true`: usar `fetchAll()` e retornar tudo num único JSON `{ data: [...], meta: { total, all: true } }`.
- Sem `?all=true`: comportamento atual (paginado).

### 3. Endpoints de KPIs (`bi-kpis-comercial`, `bi-kpis-financeiro`, `bi-kpis-operacao`)
- Trocar a query única por `fetchAll()` — sempre lê todas as linhas do período antes de agregar, garantindo KPIs corretos mesmo com mais de 1000 registros.

### 4. `admin_.api-keys.tsx` (documentação)
- Adicionar nota: **"Para baixar TUDO de uma vez (sem paginar), adicione `&all=true` na URL. KPIs já vêm sempre completos."**
- Atualizar exemplo curl com `&all=true`.

## Limite de segurança
Cap de 200.000 linhas por request com `all=true`, para evitar timeout do Worker e estouro de memória.
