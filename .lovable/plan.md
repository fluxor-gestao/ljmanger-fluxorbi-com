## Objetivo

Evoluir operacionalmente as duas telas existentes do módulo financeiro (Movimentação e Conciliação), preservando 100% da identidade visual atual (sidebar, paleta, cards gradientes, tipografia, componentes shadcn). Nada será reconstruído — apenas adicionadas tabs, colunas, agrupamentos, filtros e um rodapé fixo, além de melhorias de densidade e contexto na conciliação.

## Tela 1 — Movimentação Financeira (`/financeiro`)

**1. Cards superiores (substituir o conteúdo, manter o estilo atual)**
- Saldo Inicial · Total Receitas · Total Despesas · Transferências Internas · Saldo Final · Disponível Total Atual
- Reaproveita os mesmos `Card` + ícones já usados; só muda o cálculo e os labels.

**2. Tabs internas** (componente `Tabs` shadcn, abaixo dos cards):
- **Consolidado** — previsto + realizado (visão padrão, igual à atual)
- **Previsões** — `source_type='manual'` originadas do comercial (`document_reference` referencia devis) e `conciliation_status='pendente'`
- **Realizados** — `conciliation_status='conciliado'`
- **Fluxo Bancário** — agrupado por `bank_account_id` → render por banco com subtotais (receitas, despesas, saldo); usa um único componente de seção colapsável, não múltiplas tabelas
- **Receitas x Despesas** — visão analítica simples (tabela pivotada por competência ou cards de totais por categoria)

**3. Filtros (linha acima da tabela, expandir os atuais)**
- Competência (mês/ano) · Banco/Conta (`Select` populado de `bank_accounts`) · Tipo (receita/despesa/transferência) · Negócio · Conta Movimentação · Status · Origem (comercial/manual/ofx) · Previsto/Realizado

**4. Tabela financeira (mesma `Table`, mais densa)**
- Linhas mais compactas (`py-1.5` no `TableCell`), zebra suave (`even:bg-muted/30`), cabeçalho com peso maior, badges coloridas, valores com `tabular-nums font-medium`
- Novas colunas: **Banco/Conta**, **Tipo**, **Origem**, **Previsto/Realizado**, **Conciliado** (✓/–)
- Coluna "Origem" derivada de `source_type` + presença de `document_reference`

**5. Agrupamento por banco (na aba Fluxo Bancário)**
- Componente `BankGroup` que renderiza header do banco + linhas + linha de subtotal (receitas / despesas / saldo)
- Sem múltiplas tabelas independentes — uma única `Table` com `TableRow` de header de grupo entre blocos

**6. Transferências Internas**
- Adicionar `entry_type='transferencia'` ao enum (migration) e badge azul própria
- Não somam em receita/despesa nos cards
- Campo opcional `transfer_pair_id` para vincular origem ↔ destino

**7. Rodapé fixo**
- Barra inferior sticky dentro do `<main>`: Total Entradas · Total Saídas · Total Transferências · Saldo Final
- Usa `bg-card border-t` para combinar com o header atual

## Tela 2 — Conciliação Bancária (`/conciliacao`)

Mantém o layout atual (extrato à esquerda, lançamentos à direita, ações no centro). Apenas evolui o contexto e a densidade.

**1. Barra de contexto financeiro no topo**
- Seletor de Banco + Conta + Competência
- Cards compactos: Saldo Banco · Saldo Sistema · Diferença · Pendências · Conciliados

**2. Visual mais "extrato bancário"**
- Linhas mais compactas, fonte tabular nos valores, divisores sutis
- Coluna de data em formato `dd/MM`, descrição truncada com tooltip, valor alinhado à direita com cor por sinal

**3. Sugestões automáticas com score**
- Badges: **Match Exato** (verde, 100%) · **Match Provável** (amarelo, 60–99%) · **Sem Sugestão** (cinza)
- Critérios combinados: igualdade de valor (peso alto), proximidade de data (±3 dias), similaridade de descrição (Levenshtein simples client-side), banco correspondente
- Percentual exibido na badge

**4. Ações rápidas (toolbar por linha)**
- Conciliar · Desfazer · Ignorar · Buscar lançamento (abre dialog de busca) · Novo lançamento · Marcar como Transferência Interna

## Mudanças de schema (migration)

- `financial_entries`: adicionar valor `'transferencia'` ao enum `entry_type` e coluna `transfer_pair_id uuid` (nullable, self-reference lógica)
- `financial_entries`: adicionar coluna `realized boolean default false` para distinguir previsto/realizado de forma explícita (atualizada pelo trigger de conciliação)
- Sem mudanças em RLS (políticas atuais já cobrem)

## Arquivos a editar / criar

- `src/routes/_authenticated/financeiro.tsx` — adicionar tabs, novos cards, filtros, colunas, rodapé
- `src/routes/_authenticated/conciliacao.tsx` — barra de contexto, score nas sugestões, ações rápidas
- `src/components/financeiro/SummaryCards.tsx` — extrair os 6 cards
- `src/components/financeiro/BankGroup.tsx` — render agrupado por banco
- `src/components/financeiro/EntriesTable.tsx` — tabela compacta reutilizável (Consolidado / Previsões / Realizados)
- `src/components/financeiro/FinanceFooter.tsx` — rodapé fixo com totais
- `src/components/financeiro/FilterBar.tsx` — barra de filtros
- `src/components/conciliacao/ContextHeader.tsx` — banco/conta/competência + cards de saldo
- `src/components/conciliacao/MatchBadge.tsx` — badge de score
- `src/lib/matchScore.ts` — função de scoring client-side
- migration SQL para enum + colunas

## Identidade visual preservada

- Continua usando `Card`, `Table`, `Badge`, `Tabs`, `Select`, `Input` do shadcn já presentes
- Cores via tokens `--primary`, `--success`, `--warning`, `--destructive`, `--accent` (sem cores hardcoded)
- Mesmos ícones lucide, mesmas fontes (Inter / Space Grotesk)
- Mesmo padrão de gradiente (`from-primary to-accent`) usado no card "Conciliação"

## Fora de escopo (não será feito agora)

- Reconstruir o módulo
- Trocar paleta, tipografia ou layout da sidebar
- Novas integrações externas (open banking, etc.)
- Relatórios/BI adicionais — o existente em `/bi` continua o mesmo
