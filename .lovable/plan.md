## Objetivo
Remover os botões duplos de tier na geração inicial. Geração automática com **GPT-5 mini** ao carregar a Ata. Botão único **"Refinar proposta"** disponível apenas na tela de detalhe/edição do devis.

## Mudanças

### 1. `src/components/devis/UploadAtaDialog.tsx` (e/ou fluxo de upload da Ata em `comercial.tsx`)
- Remover qualquer seleção/exibição de tier.
- Ao gerar, chamar `generate-devis-proposal` **sem** `tier` (default = `gpt-5-mini`). Apenas um botão: "Gerar proposta".

### 2. `src/routes/_authenticated/comercial.tsx`
- Se existir botão "Refinar com GPT-5" no kanban/listagem, remover. Refinamento só dentro do devis.

### 3. `src/routes/_authenticated/comercial_.devis.$id.tsx`
- Remover os dois botões atuais ("Gerar (GPT-5 mini)" + "Refinar com GPT-5").
- Adicionar **um único botão** discreto `Refinar proposta` no header de ações da proposta (ao lado de Salvar/Enviar), com ícone Sparkles.
- Comportamento: chama `generate-devis-proposal` com `tier: 'final'` reutilizando a Ata original já salva no devis + dados atuais (client_name, total_amount). Mostra confirmação ("Isto irá sobrescrever os campos editáveis da proposta. Continuar?") antes de aplicar.
- Estado de loading no próprio botão ("Refinando…"), toast de sucesso/erro.

### 4. Backend (`supabase/functions/generate-devis-proposal/index.ts`)
- Nenhuma alteração de lógica. Já aceita `tier` opcional (default → `gpt-5-mini`, `final` → `gpt-5`). Mantido como está.

## Resultado UX
- Cliente carrega Ata → proposta gerada automaticamente com gpt-5-mini, sem escolhas.
- Cliente abre o devis para revisar → vê um botão "Refinar proposta" caso queira melhorar a redação final com gpt-5.
- Zero explicação sobre modelos de IA na UI.

## Perguntas
1. O botão "Refinar proposta" deve **sobrescrever** os campos editáveis atuais, ou gerar uma **nova versão** e pedir confirmação campo a campo? (Recomendo sobrescrever com confirmação prévia única — mais simples para o usuário.)
