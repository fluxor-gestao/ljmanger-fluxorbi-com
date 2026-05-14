import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Hash, FileText } from "lucide-react";

export type ServicePrefix = "DE" | "AM" | "CO";

const PREFIX_LABEL: Record<ServicePrefix, string> = {
  DE: "Advocacia",
  AM: "Ambiental",
  CO: "Contábil",
};

export function inferServicePrefix(...sources: (string | null | undefined)[]): ServicePrefix {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  if (/(ambient|environment|ambiental|sustent)/.test(text)) return "AM";
  if (/(cont[áa]bil|cont[aá]bei|accounting|fiscal|tribut|imposto)/.test(text)) return "CO";
  return "DE";
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName?: string;
  initialPrefix: ServicePrefix;
  serviceTypeHint?: string;
  onConfirm: (data: { prefix: ServicePrefix; devis_number: string; service_type: string }) => void;
}

export default function DevisCodePreviewDialog({
  open,
  onOpenChange,
  clientName,
  initialPrefix,
  serviceTypeHint,
  onConfirm,
}: Props) {
  const [prefix, setPrefix] = useState<ServicePrefix>(initialPrefix);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setPrefix(initialPrefix);
  }, [open, initialPrefix]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("next_devis_number", { _prefix: prefix });
      if (!cancelled) {
        setCode(error ? "" : (data as string));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, prefix]);

  const handleConfirm = () => {
    if (!code) return;
    onConfirm({
      prefix,
      devis_number: code,
      service_type: serviceTypeHint || PREFIX_LABEL[prefix],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" /> Código do Devis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {clientName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Cliente:</span>
              <span className="font-medium text-foreground">{clientName}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Tipo de serviço</Label>
            <RadioGroup
              value={prefix}
              onValueChange={(v) => setPrefix(v as ServicePrefix)}
              className="grid grid-cols-3 gap-2"
            >
              {(Object.keys(PREFIX_LABEL) as ServicePrefix[]).map((p) => (
                <label
                  key={p}
                  className={`flex flex-col items-center gap-1 rounded-md border p-3 cursor-pointer transition-colors ${
                    prefix === p ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <RadioGroupItem value={p} className="sr-only" />
                  <span className="text-lg font-bold font-display">{p}</span>
                  <span className="text-[11px] text-muted-foreground">{PREFIX_LABEL[p]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 text-center space-y-1">
            <div className="text-xs text-muted-foreground">Código previsto</div>
            <div className="text-2xl font-bold font-display tracking-wider tabular-nums">
              {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : code || "—"}
            </div>
            <Badge variant="outline" className="text-[10px]">
              {PREFIX_LABEL[prefix]} · {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!code || loading}>
            Confirmar e gerar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
