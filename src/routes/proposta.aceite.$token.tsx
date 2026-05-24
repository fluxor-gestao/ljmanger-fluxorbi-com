import { useEffect, useState } from "react";
import { useNavigate, useParams, Link, createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, AlertCircle, Calendar, FileText, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import logo from "@/assets/logo.svg";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/accept-devis-proposal`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Preview = {
  title: string;
  client_name: string | null;
  total_amount: number;
  down_payment_amount: number;
  deadline_date: string | null;
  scope_description: string | null;
  proposal_structure: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
};

type State =
  | "loading"
  | "not_found"
  | "ready"
  | "accepting"
  | "rejecting"
  | "success"
  | "rejected"
  | "already_accepted"
  | "already_rejected"
  | "error";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

function AceitarProposta() {
  const { token } = Route.useParams();
  const [state, setState] = useState<State>("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${token}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        if (res.status === 404) return setState("not_found");
        if (!res.ok) {
          setErrorMsg("Não foi possível carregar a proposta.");
          return setState("error");
        }
        const data: Preview = await res.json();
        setPreview(data);
        if (data.accepted_at) setState("already_accepted");
        else if (data.rejected_at) setState("already_rejected");
        else setState("ready");
      } catch {
        setErrorMsg("Erro de conexão.");
        setState("error");
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    setState("accepting");
    try {
      const res = await fetch(`${FN_URL}?token=${token}`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      if (!res.ok) {
        setErrorMsg("Não foi possível registrar o aceite.");
        return setState("error");
      }
      const data: Preview = await res.json();
      setPreview(data);
      setState("success");
    } catch {
      setErrorMsg("Erro de conexão.");
      setState("error");
    }
  };

  const handleReject = async () => {
    setRejectOpen(false);
    setState("rejecting");
    try {
      const res = await fetch(`${FN_URL}?token=${token}&action=reject`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || null }),
      });
      if (!res.ok) {
        setErrorMsg("Não foi possível registrar a recusa.");
        return setState("error");
      }
      const data: Preview = await res.json();
      setPreview(data);
      setState("rejected");
    } catch {
      setErrorMsg("Erro de conexão.");
      setState("error");
    }
  };

  const showAccepted = state === "success" || state === "already_accepted";
  const showRejected = state === "rejected" || state === "already_rejected";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-4">
          <img src={logo} alt="Lundgaard Jensen" className="h-10 w-auto" />
          <div>
            <div className="font-display text-lg font-semibold tracking-wide text-foreground leading-tight">
              LUNDGAARD JENSEN
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Advocacia &amp; Consultoria Internacional
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            Carregando proposta...
          </div>
        )}

        {state === "not_found" && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h1 className="text-xl font-semibold mb-2">Proposta não encontrada</h1>
              <p className="text-muted-foreground">O link pode ter expirado ou estar incorreto.</p>
            </CardContent>
          </Card>
        )}

        {state === "error" && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
              <h1 className="text-xl font-semibold mb-2">Algo deu errado</h1>
              <p className="text-muted-foreground">{errorMsg}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        )}

        {(state === "ready" ||
          state === "accepting" ||
          state === "rejecting" ||
          showAccepted ||
          showRejected) &&
          preview && (
            <div className="space-y-6">
              {showAccepted && (
                <Card className="border-green-500/40 bg-green-500/5">
                  <CardContent className="py-6 flex items-start gap-4">
                    <CheckCircle2 className="h-10 w-10 text-green-600 flex-shrink-0" />
                    <div>
                      <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">
                        {state === "success"
                          ? "Proposta aceita com sucesso!"
                          : "Esta proposta já foi aceita"}
                      </h2>
                      {preview.accepted_at && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Em {format(parseISO(preview.accepted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      <p className="text-sm mt-2">
                        Em breve você receberá a cobrança inicial de <strong>50%</strong> do valor total
                        ({fmtBRL(preview.down_payment_amount)}) para iniciarmos os próximos passos.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {showRejected && (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardContent className="py-6 flex items-start gap-4">
                    <XCircle className="h-10 w-10 text-destructive flex-shrink-0" />
                    <div>
                      <h2 className="text-xl font-semibold text-destructive">
                        {state === "rejected"
                          ? "Proposta recusada"
                          : "Esta proposta já foi recusada"}
                      </h2>
                      {preview.rejected_at && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Em {format(parseISO(preview.rejected_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      <p className="text-sm mt-2">Agradecemos seu retorno.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">{preview.title}</CardTitle>
                  {preview.client_name && (
                    <p className="text-muted-foreground">
                      Para: <span className="font-medium text-foreground">{preview.client_name}</span>
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Valor total</div>
                      <div className="text-2xl font-bold mt-1">{fmtBRL(preview.total_amount)}</div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Entrada (50%)</div>
                      <div className="text-2xl font-bold mt-1">{fmtBRL(preview.down_payment_amount)}</div>
                    </div>
                  </div>

                  {preview.deadline_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Prazo:</span>
                      <span className="font-medium">{format(parseISO(preview.deadline_date), "dd/MM/yyyy")}</span>
                    </div>
                  )}

                  {preview.scope_description && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                        <FileText className="h-4 w-4" /> Escopo
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{preview.scope_description}</p>
                    </div>
                  )}

                  {preview.proposal_structure && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                        <FileText className="h-4 w-4" /> Estrutura da proposta
                      </div>
                      <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h2:mt-5 prose-h3:mt-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {preview.proposal_structure}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {state === "ready" && (
                <div className="flex flex-col items-center gap-3 pt-2">
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="px-10 bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleAccept}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Aceitar proposta
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-10 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setRejectOpen(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Recusar proposta
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center max-w-md">
                    Ao aceitar, você confirma a contratação dos serviços conforme descritos acima.
                    Esta ação não poderá ser desfeita.
                  </p>
                </div>
              )}

              {state === "accepting" && (
                <div className="flex justify-center pt-2">
                  <Button size="lg" disabled className="px-10">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando aceite...
                  </Button>
                </div>
              )}

              {state === "rejecting" && (
                <div className="flex justify-center pt-2">
                  <Button size="lg" disabled variant="outline" className="px-10">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando recusa...
                  </Button>
                </div>
              )}
            </div>
          )}
      </main>

      <footer className="border-t bg-background mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-xs text-muted-foreground leading-relaxed">
          <div className="font-medium text-foreground">Lundgaard Jensen Advocacia &amp; Consultoria Internacional</div>
          <div>Rua João Cordeiro, 831 – Praia de Iracema</div>
          <div>+55 (85) 9 9406-6042 &nbsp;|&nbsp; +55 (85) 9 3037-9931</div>
          <div>lundgaardjensen.com &nbsp;|&nbsp; @lundgaard.jensen</div>
        </div>
      </footer>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar proposta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja recusar esta proposta? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea
              rows={4}
              placeholder="Conte rapidamente o motivo da recusa..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/proposta/aceite/$token")({
  component: AceitarProposta,
});
