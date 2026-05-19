## Diagnóstico

Consultando o banco, identifiquei a causa exata do descompasso:

| Devis | Aceito em | Cobrança pendente | Serviço vinculado |
|---|---|---|---|
| DE202605004 | 18/05 | ✅ 1 | ✅ 1 (status `concluido`) |
| DE202605003 | 15/05 | ✅ 1 | ✅ 1 (`em_andamento`) |
| **DE202605002** | 13/05 | ✅ 1 | ❌ **0** |
| **DE202605001** | 12/05 | ✅ 1 | ❌ **0** |
| DE202604003 | 30/04 | ✅ 1 | ✅ 1 (`em_andamento`) |
| DE202604002 | 30/04 | ✅ 1 | ✅ 1 (`concluido`) |
| DE202604001 | 24/04 | ✅ 1 | ✅ 1 (`em_andamento`) |

**Dois problemas concorrentes:**

1. **DE202605002 e DE202605001** foram aceitos *antes* da trigger `devis_accepted_create_service` existir → nunca geraram serviço na Operação. Aparecem em "Cobrança pendente" mas não em "Enviado para operação" nem na página `/operacao`.
2. **DE202605004 e DE202604002** já têm serviço, mas com status `concluido`. A regra atual do Kanban só mostra na coluna "Enviado para operação" serviços `a_iniciar` ou `em_andamento` (linha em `DevisKanban.tsx`: `hasActiveSvc = svcs.some(s => s.status === "a_iniciar" || "em_andamento")`). Por isso somem da coluna mesmo continuando com cobrança pendente.

Resultado: contagens divergentes nas duas colunas.

## Solução

### 1. Backfill (migration de dados)

Criar serviços faltantes para todo devis aceito sem `services` vinculado:

```sql
INSERT INTO public.services (devis_id, client_id, business_unit, responsible_sector,
                             title, description, status, expected_end_date)
SELECT d.id, d.client_id, d.business_unit, d.responsible_sector,
       coalesce(d.title, 'Serviço — ' || coalesce(d.devis_number,'')),
       d.scope_description, 'a_iniciar'::service_status, d.deadline_date
FROM public.devis d
WHERE d.accepted_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.devis_id = d.id);
```

Isso resolve DE202605002 e DE202605001 e blinda contra qualquer aceite anterior à trigger.

### 2. Ajuste de regra do Kanban (`src/components/devis/DevisKanban.tsx`)

Trocar o filtro de presença na coluna "Enviado para operação" de "serviço ativo" para "qualquer serviço vinculado":

```ts
// antes
const hasActiveSvc = svcs.some((s) => s.status === "a_iniciar" || s.status === "em_andamento");
if (hasActiveSvc) cols.push("enviado_para_operacao");

// depois
if (svcs.length > 0) cols.push("enviado_para_operacao");
```

Justificativa: o sentido da coluna é "esta proposta foi encaminhada à Operação". Uma vez encaminhada, ela permanece visível no funil comercial até a baixa da cobrança — independente do progresso interno da Operação. Assim, **toda proposta com cobrança pendente também aparece em "Enviado para operação"** e as quantidades batem.

Opcional (recomendado): exibir um pequeno badge de status do serviço (`a iniciar` / `em andamento` / `concluído`) dentro do card quando renderizado na coluna "Enviado para operação", para o comercial saber o estágio operacional sem sair do Kanban. Reutiliza `serviceStatusColors` já existente em `operacao.tsx`.

### 3. Página Operação

Nenhuma mudança de código necessária — `/operacao` já faz `select("*")` em `services` sem filtros, então os 2 serviços criados no backfill aparecem automaticamente, com status `a_iniciar`.

## Resultado esperado

- "Cobrança pendente" e "Enviado para operação" passam a ter **exatamente o mesmo conjunto** de cards (7 hoje).
- Os 2 devis órfãos (DE202605002, DE202605001) aparecem em `/operacao` para o time iniciar.
- Triggers continuam garantindo paridade para todo aceite futuro.

## Preservação visual

Sem mudanças de paleta, tipografia, layout ou novos componentes. Apenas:
- Uma linha de lógica em `DevisKanban.tsx`
- (Opcional) Badge de status do serviço no card, usando tokens já existentes

## Arquivos afetados

- **Migration**: backfill SQL (uma só, sem alteração de schema)
- **`src/components/devis/DevisKanban.tsx`**: filtro de `hasActiveSvc` → `svcs.length > 0`; opcional badge de status

Posso seguir com a implementação?
