import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Users, FileText, Eye, Pencil, CalendarIcon, Filter, LayoutGrid, List, Sparkles, Loader2, Upload, ArrowLeft, Send, Clock, CheckCircle2, HelpCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ALL_STATUSES, STATUS_LABELS as statusLabels, STATUS_BADGE_CLASSES as devisStatusColors } from "@/lib/devisStatus";
import DevisKanban from "@/components/devis/DevisKanban";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import AISuggestionsBlock, { type AISuggestions } from "@/components/devis/AISuggestionsBlock";
import UploadAtaDialog, { type ConfirmedAtaResult } from "@/components/devis/UploadAtaDialog";
import DevisCodePreviewDialog, { inferServicePrefix, type ServicePrefix } from "@/components/devis/DevisCodePreviewDialog";
import { CurrencyInputBRL } from "@/components/ui/currency-input-brl";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

type ClientForm = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  type: "PF" | "PJ";
  notes: string;
};

const emptyClient: ClientForm = { name: "", email: "", phone: "", document: "", type: "PJ", notes: "" };

type DevisForm = {
  client_id: string;
  meeting_date: Date | undefined;
  commercial_responsible: string;
  meeting_summary: string;
  meeting_report: string;
  status: string;
  total_amount: string;
  down_payment_amount: string;
  notes: string;
  title: string;
  devis_number: string;
  service_type: string;
  source_language: string;
};

const emptyDevis: DevisForm = {
  client_id: "",
  meeting_date: undefined,
  commercial_responsible: "",
  meeting_summary: "",
  meeting_report: "",
  status: "reuniao_realizada",
  total_amount: "",
  down_payment_amount: "",
  notes: "",
  title: "",
  devis_number: "",
  service_type: "",
  source_language: "pt",
};

function Comercial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);

  const [devisDialogOpen, setDevisDialogOpen] = useState(false);
  const [devisForm, setDevisForm] = useState<DevisForm>(emptyDevis);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStart, setFilterStart] = useState<Date | undefined>();
  const [filterEnd, setFilterEnd] = useState<Date | undefined>();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [aiAccepted, setAiAccepted] = useState<Partial<AISuggestions>>({});
  const [generating, setGenerating] = useState(false);
  const [uploadAtaOpen, setUploadAtaOpen] = useState(false);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: devisList = [] } = useQuery({
    queryKey: ["devis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("devis").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Financial entries ligadas a devis (via document_reference = reference_number OU id)
  const { data: devisFinancialEntries = [] } = useQuery({
    queryKey: ["devis-financial-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, document_reference, conciliation_status, amount_in")
        .not("document_reference", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Services ligados a devis
  const { data: devisServices = [] } = useQuery({
    queryKey: ["devis-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, devis_id, status")
        .not("devis_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: mantém Kanban e lista sincronizados com mudanças do banco
  useEffect(() => {
    const channel = supabase
      .channel("devis-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devis" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["devis"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_entries" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["devis-financial-entries"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["devis-services"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const clientsById = useMemo(() => Object.fromEntries(clients.map((c: any) => [c.id, c])), [clients]);
  const profilesById = useMemo(() => Object.fromEntries(profiles.map((p: any) => [p.user_id, p])), [profiles]);

  const devisIndicators = useMemo(() => {
    const acceptedList = devisList.filter((d: any) => d.status === "aceita" || !!d.accepted_at);
    const sent = devisList.filter((d: any) =>
      !!d.sent_at || d.status === "enviada_ao_cliente" || d.status === "aguardando_aceite" || d.status === "aceita" || !!d.accepted_at,
    ).length;
    const waiting = devisList.filter((d: any) => d.status === "aguardando_aceite").length;
    const acceptedTotal = acceptedList.reduce((sum: number, d: any) => sum + (Number(d.total_amount) || 0), 0);

    return {
      generated: devisList.length,
      sent,
      waiting,
      accepted: acceptedList.length,
      acceptedTotal,
    };
  }, [devisList]);

  const filteredDevis = useMemo(() => {
    return devisList.filter((d: any) => {
      if (view === "list" && filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterClient !== "all" && d.client_id !== filterClient) return false;
      if (filterStart && d.meeting_date && parseISO(d.meeting_date) < filterStart) return false;
      if (filterEnd && d.meeting_date && parseISO(d.meeting_date) > filterEnd) return false;
      return true;
    });
  }, [devisList, filterStatus, filterClient, filterStart, filterEnd, view]);

  const saveClient = useMutation({
    mutationFn: async (form: ClientForm) => {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        document: form.document || null,
        type: form.type,
        notes: form.notes || null,
      };
      if (form.id) {
        const { error } = await supabase.from("clients").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cliente salvo!");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setClientDialogOpen(false);
      setClientForm(emptyClient);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createDevis = useMutation({
    mutationFn: async (form: DevisForm) => {
      const total = Number(form.total_amount) || 0;
      const down = form.down_payment_amount === "" ? total * 0.5 : Number(form.down_payment_amount) || 0;
      const client = clientsById[form.client_id];
      const title = form.title || (client ? `Devis ${client.name}` : "Novo Devis");
      const { error } = await supabase.from("devis").insert({
        client_id: form.client_id || null,
        meeting_date: form.meeting_date ? format(form.meeting_date, "yyyy-MM-dd") : null,
        commercial_responsible: form.commercial_responsible || null,
        meeting_summary: form.meeting_summary || null,
        meeting_report: form.meeting_report || null,
        status: form.status as any,
        total_amount: total,
        down_payment_amount: down,
        notes: form.notes || null,
        title,
        created_by: user?.id,
        devis_number: form.devis_number || null,
        service_type: form.service_type || aiAccepted.service_type || null,
        responsible_sector: aiAccepted.responsible_sector || null,
        scope_description: aiAccepted.scope_description || null,
        proposal_structure: aiAccepted.proposal_structure || null,
        source_language: form.source_language || "pt",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis criado!");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      setDevisDialogOpen(false);
      setDevisForm(emptyDevis);
      setAiSuggestions(null);
      setAiAccepted({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleGenerateProposal = async () => {
    if (!devisForm.meeting_report?.trim()) return;
    setGenerating(true);
    try {
      const client = clientsById[devisForm.client_id];
      const { data, error } = await supabase.functions.invoke("generate-devis-proposal", {
        body: {
          meeting_report: devisForm.meeting_report,
          client_name: client?.name,
          total_amount: Number(devisForm.total_amount) || undefined,
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

  // Pending payload entre o upload de ata e o diálogo de código
  const [pendingAta, setPendingAta] = useState<ConfirmedAtaResult | null>(null);
  const [codePreviewOpen, setCodePreviewOpen] = useState(false);

  const handleAtaConfirm = (result: ConfirmedAtaResult) => {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setPendingAta(result);
    setCodePreviewOpen(true);
  };

  const handleCodeConfirmed = ({ devis_number, service_type }: { prefix: ServicePrefix; devis_number: string; service_type: string }) => {
    if (!pendingAta) return;
    const { client_id, payload } = pendingAta;
    const total = payload.devis.total_amount || 0;
    const meetingDate = payload.meeting.date ? new Date(payload.meeting.date + "T00:00:00") : undefined;
    setDevisForm({
      client_id,
      meeting_date: isNaN(meetingDate?.getTime() ?? NaN) ? undefined : meetingDate,
      commercial_responsible: user?.id || "",
      meeting_summary: payload.meeting.summary || "",
      meeting_report: payload.meeting.report || "",
      status: "reuniao_realizada",
      total_amount: total ? String(total) : "",
      down_payment_amount: total ? String((total * 0.5).toFixed(2)) : "",
      notes: "",
      title: payload.devis.title || "",
      devis_number,
      service_type,
      source_language: payload.detected_language || "pt",
    });
    setAiAccepted({
      service_type: payload.devis.service_type || service_type,
      responsible_sector: payload.devis.responsible_sector || "",
      scope_description: payload.devis.scope_description || "",
      proposal_structure: payload.devis.proposal_structure || "",
    });
    setAiSuggestions(null);
    setCodePreviewOpen(false);
    setPendingAta(null);
    setDevisDialogOpen(true);
    toast.success(`Devis ${devis_number} pré-preenchido. Revise e salve.`);
  };

  const openEditClient = (c: any) => {
    setClientForm({
      id: c.id,
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      document: c.document ?? "",
      type: (c.type as "PF" | "PJ") ?? "PJ",
      notes: c.notes ?? "",
    });
    setClientDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Devis</h1>
          <p className="text-muted-foreground mt-1">Gestão comercial — clientes e propostas</p>
        </div>
        <div className="flex gap-2 sm:self-start">
          <Button variant="ghost" size="icon" asChild title="Central de Ajuda — Comercial">
            <Link to="/ajuda/comercial"><HelpCircle className="h-5 w-5" /></Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="devis">
        <TabsList>
          <TabsTrigger value="devis"><FileText className="h-4 w-4 mr-2" />Devis</TabsTrigger>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-2" />Clientes</TabsTrigger>
        </TabsList>

        {/* DEVIS TAB */}
        <TabsContent value="devis" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-600 to-slate-700 p-4 text-white shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/85">Devis Gerados</p>
                  <p className="mt-2 text-3xl font-bold font-display leading-none">{devisIndicators.generated}</p>
                </div>
                <div className="rounded-full bg-white/15 p-2">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary-foreground/85">Devis Enviados</p>
                  <p className="mt-2 text-3xl font-bold font-display leading-none">{devisIndicators.sent}</p>
                </div>
                <div className="rounded-full bg-primary-foreground/15 p-2">
                  <Send className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-0 bg-gradient-to-br from-warning to-warning/80 p-4 text-warning-foreground shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-warning-foreground/85">Devis Aguardando</p>
                  <p className="mt-2 text-3xl font-bold font-display leading-none">{devisIndicators.waiting}</p>
                </div>
                <div className="rounded-full bg-warning-foreground/15 p-2">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-0 bg-gradient-to-br from-success to-success/80 p-4 text-success-foreground shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-success-foreground/85">Devis Aceitos</p>
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="text-3xl font-bold font-display leading-none">{devisIndicators.accepted}</p>
                    <p className="text-sm font-semibold text-success-foreground/90">{fmtBRL(devisIndicators.acceptedTotal)}</p>
                  </div>
                </div>
                <div className="rounded-full bg-success-foreground/15 p-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" /> Filtros
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Status {view === "kanban" && <span className="text-[10px]">(desativado no Kanban)</span>}</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus} disabled={view === "kanban"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ALL_STATUSES.map((k) => <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cliente</Label>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-normal", !filterStart && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {filterStart ? format(filterStart, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterStart} onSelect={setFilterStart} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Data fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-normal", !filterEnd && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {filterEnd ? format(filterEnd, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterEnd} onSelect={setFilterEnd} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {(filterStatus !== "all" || filterClient !== "all" || filterStart || filterEnd) && (
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterClient("all"); setFilterStart(undefined); setFilterEnd(undefined); }}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </Card>

          <div className="flex justify-between items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "list" | "kanban")}>
              <ToggleGroupItem value="list" aria-label="Lista" className="gap-2"><List className="h-4 w-4" /> Lista</ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban" className="gap-2"><LayoutGrid className="h-4 w-4" /> Kanban</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setUploadAtaOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Upload de Relatório / Ata
              </Button>
              <Dialog open={devisDialogOpen} onOpenChange={(o) => { setDevisDialogOpen(o); if (!o) { setDevisForm(emptyDevis); setAiSuggestions(null); setAiAccepted({}); } }}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Devis</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo Devis</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Cliente *</Label>
                    <Select value={devisForm.client_id} onValueChange={(v) => setDevisForm({ ...devisForm, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                      <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data da reunião</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start font-normal", !devisForm.meeting_date && "text-muted-foreground")}>
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {devisForm.meeting_date ? format(devisForm.meeting_date, "dd/MM/yyyy") : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={devisForm.meeting_date} onSelect={(d) => setDevisForm({ ...devisForm, meeting_date: d })} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Responsável comercial</Label>
                    <Select value={devisForm.commercial_responsible} onValueChange={(v) => setDevisForm({ ...devisForm, commercial_responsible: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Resumo da reunião</Label>
                    <Textarea rows={3} value={devisForm.meeting_summary} onChange={(e) => setDevisForm({ ...devisForm, meeting_summary: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Relatório da reunião</Label>
                    <Textarea
                      rows={6}
                      value={devisForm.meeting_report}
                      onChange={(e) => setDevisForm({ ...devisForm, meeting_report: e.target.value })}
                      placeholder="Descreva a reunião em detalhes para a IA gerar sugestões de proposta..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateProposal}
                      disabled={generating || !devisForm.meeting_report?.trim()}
                    >
                      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {generating ? "Gerando..." : "Gerar proposta automaticamente"}
                    </Button>
                  </div>
                  {aiSuggestions && (
                    <div className="md:col-span-2">
                      <AISuggestionsBlock
                        suggestions={aiSuggestions}
                        onAccept={(key, value) => setAiAccepted((s) => ({ ...s, [key]: value }))}
                        onAcceptAll={(values) => setAiAccepted(values)}
                        onDismiss={() => setAiSuggestions(null)}
                      />
                    </div>
                  )}
                  <div>
                    <Label>Status</Label>
                    <Select value={devisForm.status} onValueChange={(v) => setDevisForm({ ...devisForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((k) => <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor total (R$)</Label>
                    <CurrencyInputBRL
                      value={devisForm.total_amount}
                      onChange={(total) => {
                        const auto = total === "" ? "" : String((Number(total) * 0.5).toFixed(2));
                        setDevisForm({ ...devisForm, total_amount: total, down_payment_amount: auto });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Valor de entrada (50% auto)</Label>
                    <CurrencyInputBRL
                      value={devisForm.down_payment_amount}
                      onChange={(v) => setDevisForm({ ...devisForm, down_payment_amount: v })}
                    />
                  </div>
                  <div>
                    <Label>Título (opcional)</Label>
                    <Input value={devisForm.title} onChange={(e) => setDevisForm({ ...devisForm, title: e.target.value })} placeholder="Auto: Devis [Cliente]" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Observações</Label>
                    <Textarea rows={2} value={devisForm.notes} onChange={(e) => setDevisForm({ ...devisForm, notes: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createDevis.mutate(devisForm)} disabled={!devisForm.client_id || createDevis.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            </div>
          </div>

          <UploadAtaDialog
            open={uploadAtaOpen}
            onOpenChange={setUploadAtaOpen}
            clients={clients}
            onConfirm={handleAtaConfirm}
          />

          <DevisCodePreviewDialog
            open={codePreviewOpen}
            onOpenChange={(o) => {
              setCodePreviewOpen(o);
              if (!o) setPendingAta(null);
            }}
            clientName={pendingAta ? clientsById[pendingAta.client_id]?.name : undefined}
            initialPrefix={inferServicePrefix(
              pendingAta?.payload.devis.service_type,
              pendingAta?.payload.devis.responsible_sector,
              pendingAta?.payload.devis.scope_description,
              pendingAta?.payload.meeting.report,
            )}
            serviceTypeHint={pendingAta?.payload.devis.service_type}
            onConfirm={handleCodeConfirmed}
          />

          {view === "kanban" ? (
            <DevisKanban
              devis={filteredDevis}
              clientsById={clientsById}
              profilesById={profilesById}
              financialEntries={devisFinancialEntries}
              services={devisServices}
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead>Data Reunião</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevis.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum devis encontrado</TableCell></TableRow>
                  ) : filteredDevis.map((d: any) => (
                    <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate({ to: "/comercial/devis/$id", params: { id: d.id } })}>
                      <TableCell className="font-medium">{clientsById[d.client_id]?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={devisStatusColors[d.status] || ""}>{statusLabels[d.status] || d.status}</Badge></TableCell>
                      <TableCell className="text-right">{fmtBRL(d.total_amount)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(d.down_payment_amount)}</TableCell>
                      <TableCell>{d.meeting_date ? format(parseISO(d.meeting_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{profilesById[d.commercial_responsible]?.full_name || profilesById[d.commercial_responsible]?.email || "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/comercial/devis/$id", params: { id: d.id } })}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* CLIENTS TAB */}
        <TabsContent value="clients" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={clientDialogOpen} onOpenChange={(o) => { setClientDialogOpen(o); if (!o) setClientForm(emptyClient); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{clientForm.id ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={clientForm.type} onValueChange={(v: "PF" | "PJ") => setClientForm({ ...clientForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PF">Pessoa Física</SelectItem>
                        <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Documento (CPF/CNPJ)</Label>
                    <Input value={clientForm.document} onChange={(e) => setClientForm({ ...clientForm, document: e.target.value })} />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={3} value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => saveClient.mutate(clientForm)} disabled={!clientForm.name || saveClient.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead><TableHead>Documento</TableHead><TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente cadastrado</TableCell></TableRow>
                ) : clients.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.type || "PJ"}</Badge></TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.document}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEditClient(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/comercial")({
  component: Comercial,
});
