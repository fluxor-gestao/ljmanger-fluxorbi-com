## Problemas identificados

1. **Devis "Rascunho" some do Kanban** — `rascunho` está em `LEGACY_STATUSES`, não em `PIPELINE_STATUSES`, então o card não é renderizado em coluna nenhuma. Hoje o upload de ata cria devis com `status: "rascunho"` (em `comercial.tsx` linha 64/299) e a coluna `reuniao_realizada`/`proposta_em_geracao` ficam vazias.
2. **Sem progressão automática** por preenchimento das 5 validações.
3. **Colunas do Kanban grandes demais** — sem limite de altura, sem scroll interno.
4. **Numeração `DE202605003` engessada** — `generate_devis_number()` usa prefixo fixo `DE`, sem oferecer escolha entre `DE` (Advocacia), `AM` (Ambiental) ou `CO` (Contábil), e gera o número silenciosamente no INSERT.
5. **`entrada_recebida` e `enviado_para_operacao`** — colunas derivadas dependem de `financial_entries` (cobrança 50%) e `services` vinculados ao devis. Trigger `trg_devis_accepted_charge` cria a cobrança automaticamente no aceite (OK). Já a criação de `services` ao aceitar **não existe** — o vínculo com Operação está "desligado".

## Solução

### 1. Pipeline de status (mapping correto)

Reescrever a transição de status do devis para refletir a realidade operacional:

- **Upload de ata concluído** → cria devis com `status = 'reuniao_realizada'` (não mais `rascunho`).
- **Geração da proposta IA salva** (campos `proposal_structure`/`scope_description` preenchidos) → status passa para `proposta_em_geracao`.
- **Primeira validação marcada** (qualquer um dos 5 checkboxes) → status passa para `aguardando_validacao`.
- **Todas as 5 validações marcadas** (`validated_at` setado) → status passa para `pronta_para_envio`.
- **`enviada_ao_cliente` / `aguardando_aceite` / `aceita` / `rejeitada`** → mantém comportamento atual.

Implementação: trigger `trg_devis_status_progression` em `BEFORE UPDATE OR INSERT` na tabela `devis` que recalcula o `status` sempre que ainda não tiver passado de `pronta_para_envio` (não sobrescreve estados pós-envio). Mais robusto que controlar só no client.

Ajuste em `comercial.tsx` (`createDevis` e `handleAtaConfirm`) e `emptyDevis` para default `reuniao_realizada` em vez de `rascunho`.

### 2. Vínculo com Operação (religar `enviado_para_operacao`)

Adicionar trigger `trg_devis_accepted_create_service` espelhando o de cobrança: quando `accepted_at` for setado e ainda não existir `service` vinculado ao devis, criar registro em `public.services` com:
- `devis_id`, `client_id`, `business_unit`, `responsible_sector` herdados do devis
- `title` = título do devis
- `status = 'a_iniciar'`
- `expected_end_date = devis.deadline_date`

Isso reativa a coluna `enviado_para_operacao` no Kanban (lógica em `DevisKanban` já existe via `svcByDevis`).

`entrada_recebida` continua derivada de `financial_entries.conciliation_status = 'conciliado'` (sem mudança) — já funciona quando a conciliação bancária baixa a cobrança.

### 3. Scroll nas colunas do Kanban

Em `src/components/devis/DevisKanban.tsx`, no componente `Column`:
- Card da coluna recebe `max-h-[calc(3*7rem+2rem)]` (≈ 3 cards visíveis, considerando ~108px por card + gaps + header)
- Container interno dos itens ganha `overflow-y-auto` com scrollbar custom (classe `scrollbar-thin` do Tailwind)
- Header e badge de contagem ficam fixos acima do scroll

### 4. Diálogo de pré-geração com código sequencial

Novo componente `src/components/devis/DevisCodePreviewDialog.tsx`:
- Abre **antes** de gerar o rascunho (entre o upload de ata e o `createDevis.mutate`)
- Mostra:
  - Cliente identificado
  - **Tipo de serviço** com 3 opções (radio/select): Advocacia (DE), Ambiental (AM), Contábil (CO) — pré-selecionado pela heurística (analisando `service_type`/`responsible_sector` da IA, ou palavras-chave em `meeting_report`)
  - **Código previsto**: `{PREFIXO}{YYYY}{MM}{SEQ3}` calculado no momento, fazendo `SELECT MAX(...)` por prefixo+ano+mês
  - Botões "Confirmar e gerar rascunho" / "Cancelar"

Database:
- Generalizar `generate_devis_number()` para usar prefixo dinâmico baseado no `service_type` do devis: `DE` / `AM` / `CO` (default `DE` se ausente). O número só é gerado se `devis_number` ainda estiver nulo, então o cliente pode passar o `devis_number` pré-calculado e a função respeita.
- Helper RPC `public.next_devis_number(_prefix text)` para o diálogo consultar o próximo sequencial sem race-condition (locks via `pg_advisory_xact_lock`).

### 5. Validação imediata visual

Em `comercial_.devis.$id.tsx`, ao salvar o checklist, invalidar a query do Kanban (já feita via realtime, mas garantir invalidate explícito).

## Arquivos afetados

**Migration SQL** (uma só):
- Trigger `trg_devis_status_progression` (BEFORE INSERT/UPDATE)
- Trigger `trg_devis_accepted_create_service` (AFTER UPDATE)
- Função `next_devis_number(prefix text)` com advisory lock
- Atualizar `generate_devis_number()` para prefixo dinâmico via `service_type`
- Backfill: `UPDATE devis SET status = 'reuniao_realizada' WHERE status = 'rascunho'`

**Frontend**:
- `src/components/devis/DevisKanban.tsx` — limite de altura + scroll na `Column`
- `src/components/devis/DevisCodePreviewDialog.tsx` — **novo**
- `src/components/devis/UploadAtaDialog.tsx` — ao confirmar, abrir o `DevisCodePreviewDialog` antes de chamar `onConfirm`
- `src/routes/_authenticated/comercial.tsx` — `emptyDevis.status = 'reuniao_realizada'`, integrar diálogo de código no fluxo de criação, passar `service_type` + `devis_number` no INSERT
- `src/lib/devisStatus.ts` — adicionar helper `inferServicePrefix(text): 'DE'|'AM'|'CO'`

## Preservação visual

Sem mudanças de paleta, tipografia ou estrutura de layout. Apenas:
- Coluna do Kanban com altura fixa + scroll suave
- Novo diálogo seguindo o padrão `Dialog` shadcn já usado em `UploadAtaDialog`/`SendDevisDialog`

Pronto para implementar?