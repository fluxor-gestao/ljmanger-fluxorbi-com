// Pipeline comercial — ordem das colunas no Kanban
export const PIPELINE_STATUSES = [
  "reuniao_realizada",
  "proposta_em_geracao",
  "aguardando_validacao",
  "pronta_para_envio",
  "enviada_ao_cliente",
  "aguardando_aceite",
  "aceita",
  "rejeitada",
  "cobranca_pendente",
  "entrada_recebida",
  "enviado_para_operacao",
] as const;

// Status legados mantidos para compatibilidade (default ao criar = rascunho)
export const LEGACY_STATUSES = ["rascunho", "enviado", "aprovado", "rejeitado", "convertido"] as const;

export const ALL_STATUSES = [...PIPELINE_STATUSES, ...LEGACY_STATUSES] as const;

export const STATUS_LABELS: Record<string, string> = {
  // Pipeline
  reuniao_realizada: "Reunião realizada",
  proposta_em_geracao: "Proposta em geração",
  aguardando_validacao: "Aguardando validação",
  pronta_para_envio: "Pronta para envio",
  enviada_ao_cliente: "Enviada ao cliente",
  aguardando_aceite: "Aguardando aceite",
  aceita: "Aceita",
  rejeitada: "Rejeitada",
  cobranca_pendente: "Cobrança pendente",
  entrada_recebida: "Entrada recebida",
  enviado_para_operacao: "Enviado para operação",
  // Legados
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  convertido: "Convertido",
};

// Classes para Badge (texto + fundo suave + borda)
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  reuniao_realizada: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  proposta_em_geracao: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
  aguardando_validacao: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  pronta_para_envio: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30",
  enviada_ao_cliente: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30",
  aguardando_aceite: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  aceita: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  rejeitada: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30",
  cobranca_pendente: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  entrada_recebida: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  enviado_para_operacao: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
  // Legados
  rascunho: "bg-muted text-muted-foreground border-border",
  enviado: "bg-primary/15 text-primary border-primary/30",
  aprovado: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  rejeitado: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30",
  convertido: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
};

// Cor de borda superior da coluna do Kanban
export const STATUS_COLUMN_ACCENT: Record<string, string> = {
  reuniao_realizada: "border-t-slate-500",
  proposta_em_geracao: "border-t-blue-500",
  aguardando_validacao: "border-t-amber-500",
  pronta_para_envio: "border-t-indigo-500",
  enviada_ao_cliente: "border-t-cyan-500",
  aguardando_aceite: "border-t-yellow-500",
  aceita: "border-t-green-500",
  rejeitada: "border-t-red-500",
  cobranca_pendente: "border-t-orange-500",
  entrada_recebida: "border-t-emerald-500",
  enviado_para_operacao: "border-t-violet-500",
};

export const getStatusLabel = (s: string) => STATUS_LABELS[s] ?? s;
export const getStatusBadgeClass = (s: string) => STATUS_BADGE_CLASSES[s] ?? "bg-muted text-muted-foreground";

// Status que exigem que a proposta esteja validada (Validação Comercial concluída)
export const STATUSES_REQUIRING_VALIDATION: string[] = [
  "enviada_ao_cliente",
  "aguardando_aceite",
  "aceita",
  "rejeitada",
  "cobranca_pendente",
  "entrada_recebida",
  "enviado_para_operacao",
];

export const requiresValidation = (status: string) => STATUSES_REQUIRING_VALIDATION.includes(status);
