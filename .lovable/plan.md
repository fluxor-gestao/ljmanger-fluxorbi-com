## Adicionar card "Devis Gerados" no Comercial

Inserir um novo card colorido como **primeiro** da linha de indicadores na aba Devis, mantendo o mesmo estilo visual (gradiente, ícone à direita, número grande). Total passa de 3 → 4 cards.

### Alterações em `src/routes/_authenticated/comercial.tsx`

1. **`devisIndicators` (linha 185–199)**: adicionar `generated: devisList.length` — conta o total de devis criados no sistema.
2. **Grid (linha 379)**: alterar `md:grid-cols-3` → `md:grid-cols-4`.
3. **Novo card** inserido **antes** do "Devis Enviados", usando um gradiente distinto dos atuais (primary/warning/success). Proposta: gradiente neutro `from-slate-600 to-slate-700` com texto branco e ícone `FileText` (já importado). Mostra `{devisIndicators.generated}`.

### O que NÃO muda

- Layout geral, sidebar, tabela, filtros, fluxo.
- Demais cards permanecem idênticos.
- Nenhuma alteração em queries ou banco.
