
# Multi-moeda no Financeiro (sem redesenhar a tela)

Mantém 100% do layout, sidebar, cards, tabela e fluxo atuais. Apenas adiciona campos, 3 colunas, painel de resumo, ticker de cotações e validação cambial na conciliação. **O Comercial não é alterado em nada.**

## 1. Banco de dados (migration)

Adicionar em `financial_entries`:
- `currency` text not null default `'BRL'` — check em (`BRL`,`USD`,`EUR`,`GBP`,`CAD`,`CHF`)
- `exchange_rate` numeric not null default `1`
- `original_amount` numeric — valor na moeda original
- `total_brl` numeric — `original_amount * exchange_rate` (recalculado via trigger; conciliação pode sobrescrever)
- `fx_variation` numeric — diferença entre BRL previsto e realizado
- `fx_status` text — `null` | `'sem_variacao'` | `'com_variacao_cambial'`

Trigger:
- Em INSERT/UPDATE recalcular `total_brl = original_amount * exchange_rate` quando `original_amount` ou `exchange_rate` mudam (e `fx_status` não for `'com_variacao_cambial'`).

Backfill: `currency='BRL'`, `exchange_rate=1`, `original_amount = coalesce(amount_in,amount_out)`, `total_brl = original_amount`.

**Sem alterações em `devis` nem em `create_devis_initial_charge`** — lançamentos vindos do Comercial nascem em BRL (default) e o Financeiro reclassifica depois.

## 2. Comercial — NÃO alterar

Nenhuma mudança. Devis continua como está hoje, lançamentos chegam ao Financeiro em BRL/taxa 1.

## 3. Tela Financeira — colunas novas (com edição inline)

Em `src/routes/_authenticated/financeiro.tsx`, na tabela existente, **inserir entre Entrada e Saída**:

- **Moeda** — célula com `Select` compacto (BRL/USD/EUR/GBP/CAD/CHF). Ao trocar:
  - se for ≠ BRL e `exchange_rate=1`, sugere automaticamente a cotação atual do ticker (`useFxRates`) — usuário pode ajustar.
  - dispara `UPDATE financial_entries SET currency=…, exchange_rate=…`.
- **Taxa de Câmbio** — célula clicável que vira input numérico (formato pt-BR, 4 casas). Desabilitada quando moeda = BRL (fixa em 1,0000).
- **Valor Total** — somente leitura, formatado em BRL (`total_brl`).

Estilo idêntico ao restante da tabela (mesmos `TableHead/TableCell`, mesmos paddings). Edição usa `onBlur` + `useMutation` + `invalidateQueries`.

Permissão: apenas perfis `admin`/`financeiro` (já é o caso da policy atual).

## 4. Ticker de cotações (acima da tabela, ao lado dos filtros)

Novo componente `src/components/financeiro/FxTicker.tsx`:
- Faixa fina (h-8), `overflow-hidden`, animação CSS `@keyframes marquee` lenta (~40s).
- Fetch `https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,CAD-BRL,CHF-BRL` via `useQuery` (refetch 60s).
- Item: `MOEDA/BRL  valor  ▲/▼  ±%  hh:mm`.
- Cores: `text-success` alta, `text-destructive` baixa.
- Inserido na faixa horizontal dos filtros existentes, sem deslocar nada.

Hook `useFxRates()` exposto para reuso (usado pelo select de moeda para sugerir taxa).

## 5. Rodapé da tabela — botão "Ver resumo por moeda"

Mantém os totais atuais. Adiciona botão `outline` ao lado. Ao clicar abre `Popover` compacto:

```
EUR  Entradas: € 8.000   Saídas: € 1.000   Total BRL: R$ 43.200
USD  Entradas: $ 5.000   Saídas: $ 2.000   Total BRL: R$ 16.500
BRL  Entradas: R$ 2.000  Saídas: R$ 500    Total BRL: R$ 1.500
```

Agregação client-side por `currency`: soma `original_amount` (entradas/saídas) e `total_brl`.

## 6. Conciliação Bancária — variação cambial

Em `conciliacao.tsx`, no fluxo de confirmação de match:
- Comparar `bank_statement_entry.amount` (BRL recebido) com `financial_entry.total_brl` (previsto).
- Se diferença > 0.01 **e** `currency != 'BRL'`: recalcular `exchange_rate = bank_amount / original_amount`, gravar `total_brl = bank_amount`, `fx_variation = bank_amount - total_brl_previsto`, `fx_status='com_variacao_cambial'`.
- Badge `"Conciliado com variação cambial"` (cor warning) na linha — **não** marcar como divergente.
- Moeda = BRL com valores diferentes → mantém fluxo atual de `divergente`.

## 7. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*_fx_support.sql` | colunas + trigger |
| `src/routes/_authenticated/financeiro.tsx` | 3 colunas editáveis + ticker + botão resumo |
| `src/routes/_authenticated/conciliacao.tsx` | lógica de variação cambial no match |
| `src/components/financeiro/FxTicker.tsx` | **NOVO** ticker |
| `src/components/financeiro/CurrencyCell.tsx` | **NOVO** célula Moeda (select inline) |
| `src/components/financeiro/RateCell.tsx` | **NOVO** célula Taxa (input inline) |
| `src/components/financeiro/CurrencySummary.tsx` | **NOVO** popover resumo |
| `src/hooks/useFxRates.ts` | **NOVO** fetch AwesomeAPI |
| `src/styles.css` | keyframes marquee |

## Notas

- Comercial intocado.
- AwesomeAPI pública, sem chave, CORS aberto.
- `total_brl` recalculado por trigger, exceto quando a conciliação grava valor explícito (`fx_status='com_variacao_cambial'`).
- Zero alteração em design tokens, sidebar, cards, espaçamentos ou tipografia.
