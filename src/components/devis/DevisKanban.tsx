import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  PIPELINE_STATUSES,
  STATUS_LABELS,
  STATUS_COLUMN_ACCENT,
  STATUS_BADGE_CLASSES,
  requiresValidation,
} from "@/lib/devisStatus";
import { cn } from "@/lib/utils";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

// Colunas pós-aceite cuja presença é derivada de dados (não do status do devis)
const DERIVED_COLUMNS = new Set([
  "aceita",
  "cobranca_pendente",
  "entrada_recebida",
  "enviado_para_operacao",
]);

interface DevisKanbanProps {
  devis: any[];
  clientsById: Record<string, any>;
  profilesById: Record<string, any>;
  financialEntries?: any[];
  services?: any[];
}

/**
 * Calcula em quais colunas o card de um devis deve aparecer.
 * - Pré-aceite (não recusado e sem accepted_at): apenas a coluna do seu status atual.
 * - Recusado: apenas "rejeitada".
 * - Aceito: combinação derivada de financial_entries + services.
 *   "Aceita" sempre presente; "Cobrança pendente"/"Entrada recebida" conforme estado da cobrança;
 *   "Enviado para operação" enquanto o serviço estiver em a_iniciar/em_andamento.
 */
function getColumnsForDevis(
  devis: any,
  feByDevis: Record<string, any[]>,
  svcByDevis: Record<string, any[]>,
): string[] {
  if (devis.rejected_at) return ["rejeitada"];

  if (!devis.accepted_at) {
    // pré-aceite — comportamento atual: única coluna pelo status
    return PIPELINE_STATUSES.includes(devis.status) ? [devis.status] : [];
  }

  // pós-aceite — derivado
  const cols: string[] = ["aceita"];
  const fes = feByDevis[devis.id] ?? [];
  const hasPendente = fes.some((f) => f.conciliation_status === "pendente");
  const hasConciliada = fes.some((f) => f.conciliation_status === "conciliado");
  if (hasPendente) cols.push("cobranca_pendente");
  if (hasConciliada) cols.push("entrada_recebida");

  const svcs = svcByDevis[devis.id] ?? [];
  const hasActiveSvc = svcs.some((s) => s.status === "a_iniciar" || s.status === "em_andamento");
  if (hasActiveSvc) cols.push("enviado_para_operacao");

  return cols;
}

function DevisCard({
  devis,
  clientsById,
  profilesById,
  dragging = false,
  presentColumns = [],
  hasCharge = false,
  hasService = false,
  derived = false,
  columnStatus,
}: any) {
  const navigate = useNavigate();
  const client = clientsById[devis.client_id];
  const responsavel = profilesById[devis.commercial_responsible];

  // Valor exibido varia por coluna:
  // - "cobranca_pendente": valor da cobrança 50% (down_payment_amount, fallback total*0.5)
  // - "enviado_para_operacao": oculto (foco é o serviço, não o financeiro)
  // - demais: total da proposta
  let amountNode: React.ReactNode = (
    <div className="text-base font-semibold text-primary">{fmtBRL(devis.total_amount)}</div>
  );
  if (columnStatus === "cobranca_pendente") {
    const charge = Number(devis.down_payment_amount) > 0
      ? Number(devis.down_payment_amount)
      : Number(devis.total_amount) * 0.5;
    amountNode = (
      <div className="text-base font-semibold text-orange-600 dark:text-orange-400">
        {fmtBRL(charge)} <span className="text-[10px] font-normal text-muted-foreground">(50%)</span>
      </div>
    );
  } else if (columnStatus === "enviado_para_operacao") {
    amountNode = null;
  }

  const card = (
    <Card
      onClick={() => !dragging && navigate({ to: `/comercial/devis/${devis.id}` as string })}
      className={cn(
        "p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2 bg-card",
        dragging && "opacity-50",
      )}
    >
      <div className="font-medium text-sm line-clamp-2">{client?.name || devis.title || "—"}</div>
      {amountNode}
      {(hasCharge || hasService) && (
        <div className="flex flex-wrap gap-1">
          {hasCharge && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300">
              💰 Cobrança
            </Badge>
          )}
          {hasService && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300">
              🔧 Serviço
            </Badge>
          )}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">
          {responsavel?.full_name || responsavel?.email || "Sem responsável"}
        </span>
        <span>{devis.meeting_date ? format(parseISO(devis.meeting_date), "dd/MM") : "—"}</span>
      </div>
    </Card>
  );

  if (derived && presentColumns.length > 1) {
    const labels = presentColumns.map((c: string) => STATUS_LABELS[c]).join(", ");
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{card}</div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Aparece em: {labels}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
}

function DraggableCard({
  devis,
  clientsById,
  profilesById,
  columnId,
  ...rest
}: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${devis.id}::${columnId}`,
  });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <DevisCard
        devis={devis}
        clientsById={clientsById}
        profilesById={profilesById}
        dragging={isDragging}
        {...rest}
      />
    </div>
  );
}

function StaticCard(props: any) {
  return <DevisCard {...props} />;
}

function Column({
  status,
  items,
  clientsById,
  profilesById,
  isDerivedColumn,
}: any) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex-shrink-0 w-72">
      <Card
        className={cn(
          "border-t-4 p-3 h-full flex flex-col",
          STATUS_COLUMN_ACCENT[status] ?? "border-t-border",
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">{STATUS_LABELS[status]}</div>
          <Badge variant="outline" className={cn("text-xs", STATUS_BADGE_CLASSES[status])}>
            {items.length}
          </Badge>
        </div>
        <div
          ref={setNodeRef}
          className={cn(
            "space-y-2 min-h-[200px] flex-1 rounded-md p-1 transition-colors",
            isOver && !isDerivedColumn && "bg-accent/50",
          )}
        >
          {items.map((item: any) =>
            item.derived ? (
              <StaticCard
                key={`${item.devis.id}-${status}`}
                devis={item.devis}
                clientsById={clientsById}
                profilesById={profilesById}
                presentColumns={item.presentColumns}
                hasCharge={item.hasCharge}
                hasService={item.hasService}
                columnStatus={status}
                derived
              />
            ) : (
              <DraggableCard
                key={`${item.devis.id}-${status}`}
                devis={item.devis}
                clientsById={clientsById}
                profilesById={profilesById}
                columnId={status}
                columnStatus={status}
              />
            ),
          )}
          {items.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6">Vazio</div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function DevisKanban({
  devis,
  clientsById,
  profilesById,
  financialEntries = [],
  services = [],
}: DevisKanbanProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Indexar financial_entries por devis.id (matching via reference_number OU id no document_reference)
  const feByDevis = useMemo(() => {
    const map: Record<string, any[]> = {};
    const byRef: Record<string, string> = {};
    devis.forEach((d: any) => {
      if (d.reference_number) byRef[d.reference_number] = d.id;
      byRef[d.id] = d.id;
    });
    financialEntries.forEach((fe: any) => {
      const ref = fe.document_reference;
      if (!ref) return;
      const devisId = byRef[ref];
      if (!devisId) return;
      (map[devisId] ??= []).push(fe);
    });
    return map;
  }, [devis, financialEntries]);

  const svcByDevis = useMemo(() => {
    const map: Record<string, any[]> = {};
    services.forEach((s: any) => {
      if (!s.devis_id) return;
      (map[s.devis_id] ??= []).push(s);
    });
    return map;
  }, [services]);

  // Agrupar cards por coluna usando getColumnsForDevis
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    PIPELINE_STATUSES.forEach((s) => (map[s] = []));
    devis.forEach((d: any) => {
      const cols = getColumnsForDevis(d, feByDevis, svcByDevis);
      const derived = !!d.accepted_at && !d.rejected_at;
      const hasCharge = (feByDevis[d.id] ?? []).length > 0;
      const hasService = (svcByDevis[d.id] ?? []).length > 0;
      cols.forEach((col) => {
        if (!map[col]) return;
        map[col].push({
          devis: d,
          derived,
          presentColumns: cols,
          hasCharge,
          hasService,
        });
      });
    });
    return map;
  }, [devis, feByDevis, svcByDevis]);

  const activeDevis = useMemo(() => {
    if (!activeId) return null;
    const [id] = activeId.split("::");
    return devis.find((d: any) => d.id === id) ?? null;
  }, [activeId, devis]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = String(over.id);
    const [activeIdStr] = String(active.id).split("::");
    const card = devis.find((d: any) => d.id === activeIdStr);
    if (!card || card.status === newStatus) return;
    if (!PIPELINE_STATUSES.includes(newStatus as any)) return;

    // Bloqueio: cards aceitos/rejeitados não são arrastáveis (só aparecem como derivados)
    if (card.accepted_at || card.rejected_at) {
      toast.info("Esta proposta avançou no funil — colunas pós-aceite são atualizadas automaticamente.");
      return;
    }

    // Bloqueio: arrastar de pré-aceite para coluna derivada não é permitido
    if (DERIVED_COLUMNS.has(newStatus)) {
      toast.error("Esta coluna é preenchida automaticamente após o aceite do cliente.");
      return;
    }

    // Bloqueio: status que exige validação comercial
    if (requiresValidation(newStatus) && !card.validated_at) {
      toast.error("É necessário validar a proposta antes de enviá-la ao cliente");
      return;
    }

    // Optimistic update
    queryClient.setQueryData(["devis"], (old: any[] | undefined) =>
      (old ?? []).map((d) => (d.id === card.id ? { ...d, status: newStatus } : d)),
    );

    const { error } = await supabase
      .from("devis")
      .update({ status: newStatus as any })
      .eq("id", card.id);

    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
      queryClient.invalidateQueries({ queryKey: ["devis"] });
    } else {
      toast.success(`Movido para "${STATUS_LABELS[newStatus]}"`);
      queryClient.invalidateQueries({ queryKey: ["devis"] });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            items={grouped[status]}
            clientsById={clientsById}
            profilesById={profilesById}
            isDerivedColumn={DERIVED_COLUMNS.has(status)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDevis && (
          <DevisCard
            devis={activeDevis}
            clientsById={clientsById}
            profilesById={profilesById}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
