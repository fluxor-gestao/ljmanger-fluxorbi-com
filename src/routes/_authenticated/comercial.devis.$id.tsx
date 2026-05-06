import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Save, X, CalendarIcon, Sparkles, Loader2, Link as LinkIcon, CheckCircle2, FileDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUS_LABELS as statusLabels, STATUS_BADGE_CLASSES as devisStatusColors, requiresValidation } from "@/lib/devisStatus";
import AISuggestionsBlock, { type AISuggestions } from "@/components/devis/AISuggestionsBlock";
import ValidationChecklist from "@/components/devis/ValidationChecklist";
import { CurrencyInputBRL } from "@/components/ui/currency-input-brl";
import DevisPdfTemplate from "@/components/devis/DevisPdfTemplate";
import SendDevisDialog from "@/components/devis/SendDevisDialog";
import { exportDevisPdfFromContainer } from "@/lib/exportDevisPdf";
import { createRoot } from "react-dom/client";
import { Send } from "lucide-react";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

function DevisDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const { data: devis, isLoading } = useQuery({
    queryKey: ["devis", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("devis").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => (await supabase.from("profiles").select("user_id, full_name, email").order("full_name")).data ?? [],
  });

  const { data: linkedService } = useQuery({
    queryKey: ["devis-service", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, responsible_sector, status")
        .eq("devis_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const clientsById = useMemo(() => Object.fromEntries(clients.map((c: any) => [c.id, c])), [clients]);
  const profilesById = useMemo(() => Object.fromEntries(profiles.map((p: any) => [p.user_id, p])), [profiles]);

  useEffect(() => {
    if (devis) {
      setForm({
        ...devis,
        meeting_date: devis.meeting_date ? parseISO(devis.meeting_date) : undefined,
        deadline_date: devis.deadline_date ? parseISO(devis.deadline_date) : undefined,
        total_amount: String(devis.total_amount ?? ""),
        down_payment_amount: String(devis.down_payment_amount ?? ""),
      });
    }
  }, [devis]);

  const update = useMutation({
    mutationFn: async () => {
      // Bloqueio: status que exige validação não pode ser salvo se ainda não validado
      if (requiresValidation(form.status) && !devis.validated_at) {
        throw new Error("Valide a proposta antes de mover para este status.");
      }
      const payload = {
        client_id: form.client_id || null,
        meeting_date: form.meeting_date ? format(form.meeting_date, "yyyy-MM-dd") : null,
        deadline_date: form.deadline_date ? format(form.deadline_date, "yyyy-MM-dd") : null,
        commercial_responsible: form.commercial_responsible || null,
        meeting_summary: form.meeting_summary || null,
        meeting_report: form.meeting_report || null,
        status: form.status,
        total_amount: Number(form.total_amount) || 0,
        down_payment_amount: Number(form.down_payment_amount) || 0,
        notes: form.notes || null,
        title: form.title,
        service_type: form.service_type || null,
        responsible_sector: form.responsible_sector || null,
        scope_description: form.scope_description || null,
        proposal_structure: form.proposal_structure || null,
        validation_client_confirmed: !!form.validation_client_confirmed,
        validation_service_confirmed: !!form.validation_service_confirmed,
        validation_sector_defined: !!form.validation_sector_defined,
        validation_amount_confirmed: !!form.validation_amount_confirmed,
        validation_deadline_defined: !!form.validation_deadline_defined,
      };
      const { error } = await supabase.from("devis").update(payload).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis atualizado!");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis", id] });
      setEditing(false);
      setAiSuggestions(null);
    },
    onError: (e: any) => toast.error(e.message),
  });


  const handleGenerate = async () => {
    if (!form.meeting_report?.trim()) return;
    setGenerating(true);
    try {
      const client = clientsById[form.client_id];
      const { data, error } = await supabase.functions.invoke("generate-devis-proposal", {
        body: {
          meeting_report: form.meeting_report,
          client_name: client?.name,
          total_amount: Number(form.total_amount) || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiSuggestions(data.suggestions);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar proposta");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    const client = clientsById[devis.client_id];
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.zIndex = "-1";
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await new Promise<void>((resolve) => {
        root.render(<DevisPdfTemplate devis={devis} client={client} />);
        // aguarda render + carregamento da imagem
        setTimeout(resolve, 600);
      });
      const safeName = (client?.name || "cliente").replace(/[^\w\-]+/g, "_");
      await exportDevisPdfFromContainer(host, `Devis-${devis.devis_number || devis.id.slice(0, 8)}-${safeName}.pdf`);
      toast.success("PDF gerado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PDF");
    } finally {
      root.unmount();
      host.remove();
    }
  };

  if (isLoading || !form) return <div className="text-muted-foreground">Carregando...</div>;
  if (!devis) return <div className="text-muted-foreground">Devis não encontrado.</div>;

  const client = clientsById[devis.client_id];
  const responsavel = profilesById[devis.commercial_responsible];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/comercial" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-display">{devis.title}</h1>
            <p className="text-muted-foreground mt-1">
              Detalhes do devis {devis.devis_number && <span className="ml-2 font-mono text-xs px-2 py-0.5 rounded bg-muted">{devis.devis_number}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setAiSuggestions(null); setForm({ ...devis, meeting_date: devis.meeting_date ? parseISO(devis.meeting_date) : undefined, deadline_date: devis.deadline_date ? parseISO(devis.deadline_date) : undefined, total_amount: String(devis.total_amount ?? ""), down_payment_amount: String(devis.down_payment_amount ?? "") }); }}>
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={() => update.mutate()} disabled={update.isPending}>
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
            </>
          ) : (
            <>
              {devis.validated_at && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `${window.location.origin}/proposta/aceite/${devis.accept_token}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link de aceite copiado!");
                  }}
                >
                  <LinkIcon className="h-4 w-4 mr-2" /> Copiar link de aceite
                </Button>
              )}
              <Button variant="outline" onClick={handleExportPdf}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
              </Button>
              {devis.status === "pronta_para_envio" && (
                <Button onClick={() => setSendOpen(true)} className="bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4 mr-2" /> Enviar ao cliente
                </Button>
              )}
              <Button onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-2" /> Editar</Button>
            </>
          )}
        </div>
      </div>

      {devis.accepted_at && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div className="text-sm">
            <span className="font-semibold text-green-700 dark:text-green-400">Aceita pelo cliente</span>
            <span className="text-muted-foreground ml-2">
              em {format(parseISO(devis.accepted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>
      )}

      {devis.initial_charge_generated && (
        <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <div className="text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-400">Cobrança inicial gerada</span>
            <span className="text-muted-foreground ml-2">
              50% do valor total ({fmtBRL(Number(devis.down_payment_amount) || Number(devis.total_amount) * 0.5)}) lançada no Financeiro
            </span>
          </div>
        </div>
      )}

      {linkedService && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div className="text-sm">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Case operacional criado</span>
              <span className="text-muted-foreground ml-2">
                Setor: {linkedService.responsible_sector || "—"} · Status: A iniciar
              </span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/operacao" })}>
            Ver no módulo Operação
          </Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cliente */}
          <div>
            <Label>Cliente</Label>
            {editing ? (
              <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : <p className="font-medium mt-1">{client?.name || "—"}</p>}
          </div>

          {/* Status — read-only (controlado pelo Kanban Comercial) */}
          <div>
            <Label>Status</Label>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className={devisStatusColors[devis.status] || ""}>
                {statusLabels[devis.status] || devis.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Atualizado pelo Kanban Comercial
              </span>
            </div>
          </div>

          {/* Data Reunião */}
          <div>
            <Label>Data da reunião</Label>
            {editing ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal", !form.meeting_date && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {form.meeting_date ? format(form.meeting_date, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.meeting_date} onSelect={(d) => setForm({ ...form, meeting_date: d })} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                </PopoverContent>
              </Popover>
            ) : <p className="font-medium mt-1">{devis.meeting_date ? format(parseISO(devis.meeting_date), "dd/MM/yyyy") : "—"}</p>}
          </div>

          {/* Prazo (deadline) */}
          <div>
            <Label>Prazo (deadline)</Label>
            {editing ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal", !form.deadline_date && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {form.deadline_date ? format(form.deadline_date, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.deadline_date} onSelect={(d) => setForm({ ...form, deadline_date: d, validation_deadline_defined: !!d })} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                </PopoverContent>
              </Popover>
            ) : <p className="font-medium mt-1">{devis.deadline_date ? format(parseISO(devis.deadline_date), "dd/MM/yyyy") : "—"}</p>}
          </div>

          {/* Responsável */}
          <div>
            <Label>Responsável comercial</Label>
            {editing ? (
              <Select value={form.commercial_responsible ?? ""} onValueChange={(v) => setForm({ ...form, commercial_responsible: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
              </Select>
            ) : <p className="font-medium mt-1">{responsavel?.full_name || responsavel?.email || "—"}</p>}
          </div>

          {/* Valor Total */}
          <div>
            <Label>Valor total</Label>
            {editing ? (
              <CurrencyInputBRL
                value={form.total_amount}
                onChange={(total) =>
                  setForm({
                    ...form,
                    total_amount: total,
                    down_payment_amount: total === "" ? "" : String((Number(total) * 0.5).toFixed(2)),
                  })
                }
              />
            ) : <p className="font-medium mt-1 text-lg">{fmtBRL(devis.total_amount)}</p>}
          </div>

          {/* Entrada */}
          <div>
            <Label>Valor de entrada</Label>
            {editing ? (
              <CurrencyInputBRL
                value={form.down_payment_amount}
                onChange={(v) => setForm({ ...form, down_payment_amount: v })}
              />
            ) : <p className="font-medium mt-1 text-lg">{fmtBRL(devis.down_payment_amount)}</p>}
          </div>

          {/* Título */}
          <div className="md:col-span-2">
            <Label>Título</Label>
            {editing ? (
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            ) : <p className="font-medium mt-1">{devis.title}</p>}
          </div>

          {/* Relatório da reunião */}
          <div className="md:col-span-2">
            <Label>Relatório da reunião</Label>
            {editing ? (
              <div className="space-y-2">
                <Textarea rows={8} value={form.meeting_report ?? ""} onChange={(e) => setForm({ ...form, meeting_report: e.target.value })} placeholder="Descreva a reunião em detalhes para a IA gerar sugestões de proposta..." />
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating || !form.meeting_report?.trim()}
                >
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {generating ? "Gerando..." : "Gerar proposta automaticamente"}
                </Button>
              </div>
            ) : <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{devis.meeting_report || "—"}</p>}
          </div>

          {/* Resumo */}
          <div className="md:col-span-2">
            <Label>Resumo da reunião</Label>
            {editing ? (
              <Textarea rows={4} value={form.meeting_summary ?? ""} onChange={(e) => setForm({ ...form, meeting_summary: e.target.value })} />
            ) : <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{devis.meeting_summary || "—"}</p>}
          </div>

          {/* Observações */}
          <div className="md:col-span-2">
            <Label>Observações</Label>
            {editing ? (
              <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            ) : <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{devis.notes || "—"}</p>}
          </div>

          {/* Campos da proposta — editáveis */}
          {editing && (
            <>
              <div className="md:col-span-2"><Label>Tipo de serviço</Label><Input value={form.service_type ?? ""} onChange={(e) => setForm({ ...form, service_type: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Setor responsável</Label><Input value={form.responsible_sector ?? ""} onChange={(e) => setForm({ ...form, responsible_sector: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Descrição do escopo</Label><Textarea rows={5} value={form.scope_description ?? ""} onChange={(e) => setForm({ ...form, scope_description: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Estrutura da proposta</Label><Textarea rows={8} value={form.proposal_structure ?? ""} onChange={(e) => setForm({ ...form, proposal_structure: e.target.value })} /></div>
            </>
          )}

          {/* Campos da proposta — somente leitura */}
          {!editing && (devis.service_type || devis.responsible_sector || devis.scope_description || devis.proposal_structure) && (
            <>
              {devis.service_type && <div className="md:col-span-2"><Label>Tipo de serviço</Label><p className="font-medium mt-1">{devis.service_type}</p></div>}
              {devis.responsible_sector && <div className="md:col-span-2"><Label>Setor responsável</Label><p className="font-medium mt-1">{devis.responsible_sector}</p></div>}
              {devis.scope_description && <div className="md:col-span-2"><Label>Descrição do escopo</Label><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{devis.scope_description}</p></div>}
              {devis.proposal_structure && <div className="md:col-span-2"><Label>Estrutura da proposta</Label><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{devis.proposal_structure}</p></div>}
            </>
          )}
        </CardContent>
      </Card>

      {/* Validação Comercial */}
      <ValidationChecklist
        devis={devis}
        form={form}
        editing={editing}
        onToggle={(key, value) => setForm((f: any) => ({ ...f, [key]: value }))}
        profilesById={profilesById}
      />

      {/* AI Suggestions Block */}
      {editing && aiSuggestions && (
        <AISuggestionsBlock
          suggestions={aiSuggestions}
          onAccept={(key, value) => setForm((f: any) => ({ ...f, [key]: value }))}
          onAcceptAll={(values) => setForm((f: any) => ({ ...f, ...values }))}
          onDismiss={() => setAiSuggestions(null)}
        />
      )}

      <SendDevisDialog open={sendOpen} onOpenChange={setSendOpen} devis={devis} client={client} />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/comercial/devis/$id")({
  component: DevisDetail,
});
