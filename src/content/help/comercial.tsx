import { type PipelineStep } from "@/components/help/PipelineDiagram";
import { type HowToItem } from "@/components/help/HowToAccordion";
import { type FAQItem } from "@/components/help/HelpFAQ";

export const comercialOverview = [
  "O módulo Comercial cuida de todo o caminho da proposta: do primeiro contato com o cliente até o aceite formal e a geração da cobrança de entrada.",
  "Quem opera: equipe comercial e gerência. Quem consulta: financeiro (para acompanhar entradas) e operação (para receber o trabalho aprovado).",
  "Resultado esperado ao fim do fluxo: cliente cadastrado, proposta aceita, cobrança de 50% lançada no Financeiro e o serviço pronto para ser enviado à Operação.",
];

export const comercialPipeline: PipelineStep[] = [
  {
    id: "reuniao",
    label: "Reunião realizada",
    tone: "neutral",
    responsible: "Comercial",
    description:
      "Você teve a reunião com o cliente e cria o devis (proposta). Pode preencher do zero ou subir a ata da reunião para a IA extrair os pontos.",
  },
  {
    id: "geracao",
    label: "Proposta em geração",
    tone: "blue",
    responsible: "Comercial + IA",
    description:
      "A IA gera sugestões de tipo de serviço, escopo e estrutura da proposta. Você revisa, aceita ou edita cada bloco.",
  },
  {
    id: "validacao",
    label: "Aguardando validação",
    tone: "blue",
    responsible: "Comercial",
    description:
      "Antes de enviar, é preciso passar pelo checklist de validação (5 confirmações: dados do cliente, escopo, valores, prazo e responsável).",
  },
  {
    id: "pronta",
    label: "Pronta para envio",
    tone: "amber",
    responsible: "Comercial",
    description:
      "Checklist concluído. A proposta está revisada e pode ser enviada ao cliente por e-mail.",
  },
  {
    id: "enviada",
    label: "Enviada ao cliente",
    tone: "amber",
    responsible: "Sistema",
    description:
      "O sistema envia o e-mail com o PDF e um link único de aceite. O cliente recebe pelo domínio oficial da empresa.",
  },
  {
    id: "aguardando",
    label: "Aguardando aceite",
    tone: "amber",
    responsible: "Cliente",
    description:
      "O cliente abre o link, vê a proposta com valores e escopo, e decide: aceitar ou recusar (com motivo opcional).",
  },
  {
    id: "aceita",
    label: "Aceita",
    tone: "violet",
    responsible: "Cliente / Sistema",
    description:
      "Cliente clicou em aceitar. Data, hora e IP do aceite ficam registrados. O sistema dispara automaticamente a próxima etapa.",
  },
  {
    id: "cobranca",
    label: "Cobrança pendente",
    tone: "violet",
    responsible: "Sistema → Financeiro",
    description:
      "O sistema cria automaticamente um lançamento de receita no Financeiro com 50% do valor total da proposta, status 'pendente'.",
  },
  {
    id: "entrada",
    label: "Entrada recebida",
    tone: "emerald",
    responsible: "Financeiro",
    description:
      "Quando o pagamento entra na conta e é conciliado pelo Financeiro, a proposta avança para esta etapa.",
  },
  {
    id: "operacao",
    label: "Enviado para operação",
    tone: "emerald",
    responsible: "Comercial → Operação",
    description:
      "Última etapa do Comercial: o trabalho é entregue à Operação para começar a execução.",
  },
];

export const comercialHowTo: HowToItem[] = [
  {
    id: "novo-cliente",
    question: "Como cadastrar um novo cliente?",
    steps: [
      "No módulo Comercial, abra a aba 'Clientes'.",
      "Clique em 'Novo cliente' no canto superior.",
      "Preencha nome, e-mail, telefone, documento (CPF ou CNPJ) e selecione PF ou PJ.",
      "Salve. O cliente fica disponível imediatamente para vincular a propostas.",
    ],
  },
  {
    id: "proposta-zero",
    question: "Como criar uma proposta (devis) do zero?",
    steps: [
      "Aba 'Devis' → botão 'Nova proposta'.",
      "Selecione o cliente, a data da reunião e o responsável comercial.",
      "Preencha o título da proposta, valor total e prazo.",
      "Salve como rascunho. A proposta entra no Kanban na coluna 'Reunião realizada'.",
    ],
  },
  {
    id: "proposta-ata",
    question: "Como gerar uma proposta a partir da ata da reunião?",
    steps: [
      "Aba 'Devis' → botão 'Nova proposta a partir de ata'.",
      "Faça o upload do arquivo da ata (texto, PDF ou imagem).",
      "Aguarde a IA analisar e sugerir cliente, escopo, valores e estrutura.",
      "Revise tudo, confirme ou ajuste, e salve. A proposta já entra com os campos preenchidos.",
    ],
  },
  {
    id: "ia-sugestoes",
    question: "Como usar as sugestões da IA?",
    steps: [
      "Dentro de uma proposta aberta, role até o bloco 'Sugestões da IA'.",
      "Cada campo (tipo de serviço, setor, escopo, estrutura) tem um botão 'Aceitar'.",
      "Você pode editar o texto sugerido antes de aceitar.",
      "Clique em 'Aceitar todas' para aplicar tudo de uma vez. Nada é salvo até você clicar em 'Salvar' no final.",
    ],
  },
  {
    id: "validacao",
    question: "Como marcar a proposta como pronta para envio?",
    steps: [
      "Dentro da proposta, abra o bloco 'Checklist de validação'.",
      "Confirme as 5 verificações: dados do cliente conferidos, escopo claro, valores corretos, prazo viável, responsável definido.",
      "Ao marcar todas, a proposta avança automaticamente para 'Pronta para envio' e o botão de envio é liberado.",
    ],
  },
  {
    id: "enviar",
    question: "Como enviar a proposta por e-mail ao cliente?",
    steps: [
      "Com a proposta em 'Pronta para envio', clique no botão 'Enviar ao cliente'.",
      "Confira o e-mail de destino, o idioma e a mensagem que acompanha o PDF.",
      "Clique em 'Enviar'. O sistema gera o PDF, anexa, envia pelo domínio oficial e cria o link único de aceite.",
      "A proposta passa para a coluna 'Enviada ao cliente'.",
    ],
  },
  {
    id: "acompanhar",
    question: "Como acompanhar o aceite ou recusa do cliente?",
    steps: [
      "No Kanban, observe as colunas 'Enviada' → 'Aguardando aceite' → 'Aceita' ou 'Rejeitada'.",
      "Quando o cliente abre o link e decide, o status muda automaticamente.",
      "A data, hora e IP do aceite (ou motivo da recusa) ficam registrados na própria proposta.",
    ],
  },
  {
    id: "cobranca",
    question: "Quando a cobrança de 50% aparece no Financeiro?",
    steps: [
      "Assim que o cliente clica em 'Aceitar proposta', o sistema cria o lançamento sozinho.",
      "Vá em Financeiro → o lançamento aparece com status 'pendente', valor igual a 50% do total e referência à proposta.",
      "Não é preciso lançar manualmente. Se o lançamento não aparecer, veja a FAQ abaixo.",
    ],
  },
  {
    id: "kanban",
    question: "O que cada coluna do Kanban significa e como mover cards?",
    steps: [
      "Cada coluna representa uma etapa do fluxo (veja o diagrama no topo desta página).",
      "Cards azuis: ainda em preparação interna. Âmbar: aguardando ação do cliente. Roxo: aceite confirmado, fluxo financeiro disparado. Verde: dinheiro entrou e operação começou.",
      "Você pode arrastar um card manualmente quando precisar avançar uma etapa que não é automática (ex.: 'Entrada recebida' → 'Enviado para operação').",
      "Etapas automáticas (envio, aceite, cobrança) não devem ser movidas à mão.",
    ],
  },
  {
    id: "reenviar",
    question: "Como reenviar ou corrigir uma proposta já enviada?",
    steps: [
      "Abra a proposta no Kanban.",
      "Se ainda não foi aceita: edite o que precisar e use o botão 'Reenviar' — um novo PDF e um novo link são gerados.",
      "Se já foi aceita: a proposta não pode mais ser alterada. Crie uma nova proposta vinculada ao mesmo cliente, com referência à anterior nas observações.",
    ],
  },
];

export const comercialFAQ: FAQItem[] = [
  {
    id: "nao-vai-pronta",
    question: "Por que minha proposta não vai para 'Pronta para envio'?",
    answer: (
      <>
        Provavelmente o checklist de validação ainda tem itens não marcados. Abra a proposta,
        role até o bloco 'Checklist de validação' e confirme as 5 verificações. Sem todas
        marcadas, o botão de envio fica desabilitado.
      </>
    ),
  },
  {
    id: "nao-recebeu-email",
    question: "O cliente disse que não recebeu o e-mail, e agora?",
    answer: (
      <>
        Peça para o cliente conferir a caixa de spam (procurando pelo domínio
        <strong> notify.ljmanger.fluxorbi.com</strong>). Se não achar, abra a proposta e use
        a opção 'Reenviar'. Se o problema persistir, avise o time técnico — pode ser bloqueio
        no provedor do cliente.
      </>
    ),
  },
  {
    id: "link-expira",
    question: "O link de aceite expira?",
    answer: (
      <>
        Não. O link continua válido até o cliente aceitar ou recusar. Se a proposta for
        substituída por uma nova, o link antigo também continua válido — por isso, evite
        deixar duas propostas ativas para o mesmo serviço.
      </>
    ),
  },
  {
    id: "sem-cobranca",
    question: "Aceitei a proposta mas não vejo a cobrança no Financeiro",
    answer: (
      <>
        A cobrança é criada automaticamente no instante do aceite. Se ela não aparecer:
        (1) atualize a página do Financeiro; (2) confirme se a proposta tem mesmo o status
        'Aceita' (não apenas 'Enviada'); (3) verifique se o valor total da proposta é maior
        que zero. Se nada disso resolver, avise o time técnico para rodar o reprocessamento.
      </>
    ),
  },
  {
    id: "editar-enviada",
    question: "Posso editar uma proposta depois de enviada?",
    answer: (
      <>
        Sim, enquanto o cliente ainda não aceitou. Edite o que precisar e use 'Reenviar' —
        um novo PDF e link são gerados. Depois do aceite, a proposta fica congelada por
        segurança jurídica.
      </>
    ),
  },
  {
    id: "aceita-vs-cobranca",
    question: "Qual a diferença entre 'Aceita' e 'Cobrança pendente'?",
    answer: (
      <>
        'Aceita' significa que o cliente clicou no botão de aceite no link. 'Cobrança pendente'
        significa que o sistema já registrou o lançamento de 50% no Financeiro, aguardando
        o pagamento. Em fluxo normal, o card passa por 'Aceita' e segue automaticamente para
        'Cobrança pendente' em segundos.
      </>
    ),
  },
  {
    id: "recusar-pelo-cliente",
    question: "Como recuso ou cancelo uma proposta no nome do cliente?",
    answer: (
      <>
        Hoje a recusa é feita pelo próprio cliente, dentro do link de aceite. Se você precisa
        cancelar internamente uma proposta enviada (ex.: foi mandada errada), abra a proposta
        e mude o status para 'Cancelada' nas observações. Avise o cliente para ignorar o link
        anterior.
      </>
    ),
  },
];
