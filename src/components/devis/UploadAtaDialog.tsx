import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Sparkles, CheckCircle2, AlertTriangle, UserPlus, FileText } from "lucide-react";
import { toast } from "sonner";

export type AnalyzedClient = {
  name: string;
  email: string;
  phone: string;
  document: string;
  type: "PF" | "PJ" | "";
  address: string;
  city: string;
  notes: string;
};

export type AnalyzedDevis = {
  title: string;
  service_type: string;
  responsible_sector: string;
  scope_description: string;
  proposal_structure: string;
  scope_items: { letter: string; title: string; description: string; amount: number }[];
  total_amount: number;
  deadline_date: string;
};

export type AnalyzedPayload = {
  detected_language: "pt" | "fr" | "en" | "es";
  client: AnalyzedClient;
  meeting: { date: string; summary: string; report: string };
  devis: AnalyzedDevis;
};

export type ConfirmedAtaResult = {
  client_id: string;
  payload: AnalyzedPayload;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: any[];
  onConfirm: (result: ConfirmedAtaResult) => void;
}

const LANG_LABEL: Record<string, string> = {
  pt: "Português",
  fr: "Français",
  en: "English",
  es: "Español",
  auto: "Detectar automaticamente",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export default function UploadAtaDialog({ open, onOpenChange, clients, onConfirm }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [langHint, setLangHint] = useState<string>("auto");
  const [analyzing, setAnalyzing] = useState(false);
  const [payload, setPayload] = useState<AnalyzedPayload | null>(null);
  const [editClient, setEditClient] = useState<AnalyzedClient | null>(null);
  const [matchMode, setMatchMode] = useState<"existing" | "new">("new");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setStep(1);
    setFile(null);
    setLangHint("auto");
    setAnalyzing(false);
    setPayload(null);
    setEditClient(null);
    setMatchMode("new");
    setSelectedClientId("");
    setCreating(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const matches = useMemo(() => {
    if (!payload) return { exact: null as any, suggestions: [] as any[] };
    const c = payload.client;
    const docNorm = normalize(c.document);
    const emailNorm = (c.email || "").toLowerCase().trim();
    const nameNorm = normalize(c.name);

    const exact = clients.find(
      (cl: any) =>
        (docNorm && normalize(cl.document) === docNorm) ||
        (emailNorm && (cl.email || "").toLowerCase().trim() === emailNorm),
    );
    const suggestions = exact
      ? []
      : clients.filter((cl: any) => {
          if (!nameNorm) return false;
          const n = normalize(cl.name);
          return n && (n.includes(nameNorm) || nameNorm.includes(n));
        }).slice(0, 5);
    return { exact, suggestions };
  }, [payload, clients]);

  const handleAnalyze = async () => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 15 MB)");
      return;
    }
    setAnalyzing(true);
    setStep(2);
    try {
      const b64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-meeting-report", {
        body: {
          file_base64: b64,
          file_name: file.name,
          mime_type: file.type,
          language_hint: langHint,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const p = data.payload as AnalyzedPayload;
      setPayload(p);
      setEditClient(p.client);
      // Pre-select match
      const docNorm = normalize(p.client.document);
      const emailNorm = (p.client.email || "").toLowerCase().trim();
      const exact = clients.find(
        (cl: any) =>
          (docNorm && normalize(cl.document) === docNorm) ||
          (emailNorm && (cl.email || "").toLowerCase().trim() === emailNorm),
      );
      if (exact) {
        setMatchMode("existing");
        setSelectedClientId(exact.id);
      } else {
        setMatchMode("new");
      }
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Falha ao analisar a ata");
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!payload) return;
    setCreating(true);
    try {
      let clientId = selectedClientId;

      if (matchMode === "new") {
        if (!editClient?.name?.trim()) {
          toast.error("Nome do cliente obrigatório");
          setCreating(false);
          return;
        }
        const { data, error } = await supabase
          .from("clients")
          .insert({
            name: editClient.name,
            email: editClient.email || null,
            phone: editClient.phone || null,
            document: editClient.document || null,
            type: (editClient.type || "PJ") as "PF" | "PJ",
            address: editClient.address || null,
            city: editClient.city || null,
            notes: editClient.notes || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        clientId = data.id;
        toast.success("Cliente criado");
      }

      if (!clientId) {
        toast.error("Selecione ou crie um cliente");
        setCreating(false);
        return;
      }

      onConfirm({ client_id: clientId, payload });
      handleClose(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao confirmar");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Upload de Relatório / Ata
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-primary font-medium" : ""}>1. Upload</span>
          <span>→</span>
          <span className={step >= 2 ? "text-primary font-medium" : ""}>2. Análise IA</span>
          <span>→</span>
          <span className={step >= 3 ? "text-primary font-medium" : ""}>3. Revisão</span>
        </div>

        {/* Step 1: upload */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-6 border-dashed border-2 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <Label htmlFor="ata-file" className="cursor-pointer text-primary underline">
                  Selecionar arquivo
                </Label>
                <Input
                  id="ata-file"
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX ou TXT • até 15 MB</p>
              </div>
              {file && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" /> {file.name}
                </Badge>
              )}
            </Card>

            <div>
              <Label>Idioma do documento</Label>
              <Select value={langHint} onValueChange={setLangHint}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LANG_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                A IA detecta automaticamente. Use override se a detecção falhar.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleAnalyze} disabled={!file}>
                <Sparkles className="h-4 w-4 mr-2" /> Analisar com IA
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: analyzing */}
        {step === 2 && (
          <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-medium">Analisando documento...</p>
            <p className="text-xs">Detectando idioma, extraindo cliente e estruturando proposta.</p>
          </div>
        )}

        {/* Step 3: review */}
        {step === 3 && payload && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">Idioma detectado: {LANG_LABEL[payload.detected_language] || payload.detected_language}</Badge>
              {payload.meeting.date && <Badge variant="outline">Reunião: {payload.meeting.date}</Badge>}
            </div>

            {/* Client card */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Cliente
                </h3>
                {matches.exact ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Cliente encontrado
                  </Badge>
                ) : matches.suggestions.length > 0 ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Possíveis correspondências
                  </Badge>
                ) : (
                  <Badge variant="outline">Novo cliente</Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={matchMode === "existing" ? "default" : "outline"}
                  onClick={() => setMatchMode("existing")}
                >
                  Vincular existente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={matchMode === "new" ? "default" : "outline"}
                  onClick={() => setMatchMode("new")}
                >
                  Criar novo
                </Button>
              </div>

              {matchMode === "existing" ? (
                <div>
                  <Label>Selecionar cliente</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                    <SelectContent>
                      {(matches.exact ? [matches.exact] : []).concat(matches.suggestions).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.document ? `• ${c.document}` : ""}
                        </SelectItem>
                      ))}
                      {clients
                        .filter(
                          (c: any) =>
                            c.id !== matches.exact?.id &&
                            !matches.suggestions.some((s: any) => s.id === c.id),
                        )
                        .map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                editClient && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label>Nome *</Label>
                      <Input
                        value={editClient.name}
                        onChange={(e) => setEditClient({ ...editClient, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={editClient.type || "PJ"}
                        onValueChange={(v: "PF" | "PJ") => setEditClient({ ...editClient, type: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PF">Pessoa Física</SelectItem>
                          <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Documento</Label>
                      <Input
                        value={editClient.document}
                        onChange={(e) => setEditClient({ ...editClient, document: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={editClient.email}
                        onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={editClient.phone}
                        onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input
                        value={editClient.city}
                        onChange={(e) => setEditClient({ ...editClient, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Endereço</Label>
                      <Input
                        value={editClient.address}
                        onChange={(e) => setEditClient({ ...editClient, address: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Observações</Label>
                      <Textarea
                        rows={2}
                        value={editClient.notes}
                        onChange={(e) => setEditClient({ ...editClient, notes: e.target.value })}
                      />
                    </div>
                  </div>
                )
              )}
            </Card>

            {/* Devis card */}
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Devis estruturado
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs">Título</Label>
                  <p className="font-medium">{payload.devis.title || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs">Tipo de serviço</Label>
                  <p>{payload.devis.service_type || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs">Setor responsável</Label>
                  <p>{payload.devis.responsible_sector || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs">Valor total</Label>
                  <p className="font-medium">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      payload.devis.total_amount || 0,
                    )}
                  </p>
                </div>
              </div>

              {payload.devis.scope_items?.length > 0 && (
                <div>
                  <Label className="text-xs">Itens do escopo</Label>
                  <ul className="text-sm space-y-1 mt-1">
                    {payload.devis.scope_items.map((it, i) => (
                      <li key={i} className="border-l-2 border-primary pl-2">
                        <span className="font-medium">{it.letter}) {it.title}</span>
                        {it.amount > 0 && (
                          <span className="text-muted-foreground"> — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(it.amount)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {payload.devis.proposal_structure && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-primary">Ver estrutura da proposta (markdown)</summary>
                  <pre className="mt-2 whitespace-pre-wrap font-mono bg-muted/40 p-3 rounded max-h-64 overflow-y-auto">
                    {payload.devis.proposal_structure}
                  </pre>
                </details>
              )}
            </Card>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={creating || (matchMode === "existing" && !selectedClientId)}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar e abrir Devis
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
