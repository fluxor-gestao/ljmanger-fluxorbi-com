# Central de Ajuda — Escopo inicial (itens 1 a 4)

Vamos entregar a base da Central de Ajuda já com o módulo Comercial completo. Os demais módulos ficam como placeholder ("em construção") e a gente preenche conforme cada um amadurece.

## O que será entregue

### 1. Rota `/ajuda` — Índice da Central
Página inicial da ajuda, com cards clicáveis para cada módulo do sistema:

- **Comercial** (pronto, conteúdo completo)
- **Financeiro** (placeholder "em breve")
- **Conciliação** (placeholder)
- **Operação** (placeholder)
- **Gestão** (placeholder)
- **BI** (placeholder)
- **Hub** (placeholder)
- **Admin** (placeholder)

Cada card mostra: ícone do módulo, nome, 1 linha de descrição e um selo "Disponível" ou "Em breve". Layout em grid responsivo (3 colunas no desktop, 1 no mobile).

### 2. Rota `/ajuda/comercial` — Página completa do Comercial

Quatro blocos em ordem fixa, todos em **linguagem de operador** (sem jargão técnico, sem nomes de tabela, sem código):

**A. Visão geral em 3 linhas**
Resumo do que o módulo faz, para quem serve e qual o resultado final esperado (proposta aceita → cobrança gerada → entrada da operação).

**B. Fluxo visual do pipeline**
Diagrama com os 10 passos do Kanban, em quadradinhos coloridos conectados por setas:
Reunião realizada → Proposta em geração → Aguardando validação → Pronta para envio → Enviada → Aguardando aceite → Aceita → Cobrança pendente → Entrada recebida → Enviado para operação.

Cada quadradinho clicável abre uma descrição curta do que acontece naquela etapa e quem é o responsável.

**C. Passo a passo "como eu faço para…"** (accordion expansível)
- Cadastrar um novo cliente
- Criar uma proposta (devis) do zero
- Gerar proposta a partir da ata da reunião (upload + IA)
- Usar as sugestões da IA e validar o conteúdo
- Marcar a proposta como pronta para envio (checklist de validação)
- Enviar a proposta por e-mail ao cliente
- Acompanhar o aceite/recusa do cliente
- Entender quando a cobrança de 50% aparece no Financeiro
- Mover um card no Kanban e o que cada coluna significa
- Reenviar uma proposta ou corrigir uma já enviada

**D. Perguntas frequentes (FAQ)**
- "Por que minha proposta não vai para 'Pronta para envio'?"
- "O cliente disse que não recebeu o e-mail, e agora?"
- "O link de aceite expira?"
- "Aceitei a proposta mas não vejo a cobrança no Financeiro"
- "Posso editar uma proposta depois de enviada?"
- "Qual a diferença entre 'Aceita' e 'Cobrança pendente'?"
- "Como recuso/cancelo uma proposta no nome do cliente?"

### 3. Componentes reutilizáveis
Criados de forma genérica para servir aos próximos módulos sem retrabalho:

- `<HelpHero>` — cabeçalho da página com ícone, título e subtítulo
- `<PipelineDiagram>` — diagrama horizontal de etapas com hover/click
- `<HowToAccordion>` — lista de tarefas expansíveis com passo a passo numerado
- `<HelpFAQ>` — perguntas e respostas em accordion
- `<HelpCallout>` — caixa de destaque (dica, atenção, importante)
- `<ModuleCard>` — card do índice `/ajuda`

### 4. Botão "?" no header de `/comercial`
Ícone discreto no canto superior do módulo Comercial que abre `/ajuda/comercial` em nova aba (ou navega direto, a definir no detalhamento). Mesmo padrão será replicável nos outros módulos quando suas páginas forem prontas.

---

## Estrutura de arquivos

```text
src/
├── routes/
│   └── _authenticated/
│       ├── ajuda.tsx                    (índice de módulos)
│       └── ajuda.comercial.tsx          (página do Comercial)
├── components/
│   └── help/
│       ├── HelpHero.tsx
│       ├── PipelineDiagram.tsx
│       ├── HowToAccordion.tsx
│       ├── HelpFAQ.tsx
│       ├── HelpCallout.tsx
│       └── ModuleCard.tsx
└── content/
    └── help/
        └── comercial.tsx                (conteúdo: passos, FAQ, etapas)
```

Conteúdo fica em arquivo `.tsx` versionado no git (não no banco): sem latência, sem RLS, fácil de editar e revisar.

## Detalhes técnicos

- Rota protegida sob `_authenticated/` — só usuários logados acessam.
- Usa `Link` do `@tanstack/react-router` para navegação interna.
- Componentes shadcn já existentes: `Accordion`, `Card`, `Badge`, `Button`, `Tooltip`.
- Diagrama do pipeline em SVG inline (sem dependência nova).
- Linguagem 100% em português, voltada ao operador final.
- Sem mexer em nenhuma lógica de negócio existente — é só leitura/apresentação.
- Adiciona link "Central de Ajuda" no `AppSidebar` apontando para `/ajuda`.

## O que NÃO entra neste escopo
- Conteúdo dos outros módulos (ficam como "em breve")
- Busca global na ajuda
- Glossário
- Vídeos Loom embedados
- Badges "lidos" por usuário
- Sistema de favoritos / marcadores

Esses extras ficam para uma segunda iteração, depois que a base estiver validada com o time.

---

Posso seguir com a implementação?
