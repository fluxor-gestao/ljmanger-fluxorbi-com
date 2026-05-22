## Remover colunas multi-moeda e botão "Resumo por moeda" do Financeiro

Reverter apenas a parte visual adicionada anteriormente na tela Financeira, mantendo o restante do trabalho (banco, ticker de cotações, lógica de conciliação cambial) intacto.

### Alterações em `src/routes/_authenticated/financeiro.tsx`

1. **Remover as 3 colunas adicionadas** entre Entrada e Saída:
   - Coluna **Moeda** (`<TableHead>` + `<CurrencyCell />` em cada linha)
   - Coluna **Taxa** (`<TableHead>` + `<RateCell />` em cada linha)
   - Coluna **Total (BRL)** (`<TableHead>` + célula de leitura)
2. Remover os imports relacionados: `CurrencyCell`, `RateCell`.
3. **Remover o botão "Resumo por moeda"** no rodapé da tabela e o import de `CurrencySummary`.
4. Ajustar `colSpan` de células de "carregando / vazio" no `<TableBody>` para refletir o número anterior de colunas.

### Arquivos a deletar

- `src/components/financeiro/CurrencyCell.tsx`
- `src/components/financeiro/RateCell.tsx`
- `src/components/financeiro/CurrencySummary.tsx`

### O que NÃO é alterado

- `FxTicker` (ticker de cotações) permanece acima da tabela.
- `useFxRates` permanece (usado pelo ticker).
- Migration do banco (`currency`, `exchange_rate`, `total_brl`, etc.) permanece — sem perda de dados.
- Lógica de variação cambial em `conciliacao.tsx` permanece.
- Comercial intocado.

Confirma a remoção?
