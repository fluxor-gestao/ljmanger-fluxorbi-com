import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "loading" | "valid" | "already" | "invalid" | "submitting" | "success" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setStatus("invalid");
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setStatus("invalid");
          setErrorMsg(data.error || "Token inválido");
          return;
        }
        if (data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Erro ao processar");
        return;
      }
      setStatus(data.success ? "success" : "already");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 bg-card">
        <h1 className="text-2xl font-semibold">Cancelar inscrição</h1>
        {status === "loading" && (
          <p className="text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando...
          </p>
        )}
        {status === "valid" && (
          <>
            <p className="text-sm text-muted-foreground">
              Confirme abaixo para parar de receber e-mails neste endereço.
            </p>
            <Button onClick={confirm}>Confirmar cancelamento</Button>
          </>
        )}
        {status === "submitting" && (
          <p className="text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Processando...
          </p>
        )}
        {status === "success" && (
          <p className="text-sm">Pronto! Você não receberá mais e-mails neste endereço.</p>
        )}
        {status === "already" && (
          <p className="text-sm text-muted-foreground">Este endereço já estava cancelado.</p>
        )}
        {status === "invalid" && (
          <p className="text-sm text-destructive">{errorMsg || "Link inválido ou expirado."}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">{errorMsg || "Não foi possível processar."}</p>
        )}
      </div>
    </div>
  );
}
