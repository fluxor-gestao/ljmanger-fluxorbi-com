import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, ShieldAlert, AlertTriangle, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ValidationKey =
  | "validation_client_confirmed"
  | "validation_service_confirmed"
  | "validation_sector_defined"
  | "validation_amount_confirmed"
  | "validation_deadline_defined";

const ITEMS: { key: ValidationKey; label: string; sourceField: string }[] = [
  { key: "validation_client_confirmed", label: "Cliente confirmado", sourceField: "client_id" },
  { key: "validation_service_confirmed", label: "Serviço confirmado", sourceField: "service_type" },
  { key: "validation_sector_defined", label: "Setor responsável definido", sourceField: "responsible_sector" },
  { key: "validation_amount_confirmed", label: "Valor validado", sourceField: "total_amount" },
  { key: "validation_deadline_defined", label: "Prazo definido", sourceField: "deadline_date" },
];

interface Props {
  devis: any;
  form: any;
  editing: boolean;
  onToggle: (key: ValidationKey, value: boolean) => void;
  profilesById: Record<string, any>;
}

const isFieldFilled = (devis: any, field: string) => {
  const v = devis?.[field];
  if (field === "total_amount") return Number(v) > 0;
  return v !== null && v !== undefined && String(v).trim() !== "";
};

export default function ValidationChecklist({ devis, form, editing, onToggle, profilesById }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const source = editing ? form : devis;
  const checkedCount = useMemo(
    () => ITEMS.filter((it) => !!source?.[it.key]).length,
    [source],
  );
  const allChecked = checkedCount === ITEMS.length;
  const isValidated = !!devis?.validated_at;
  const validator = devis?.validated_by ? profilesById[devis.validated_by] : null;

  // Aviso: dados alterados após validação
  const staleValidation =
    isValidated &&
    devis?.updated_at &&
    new Date(devis.updated_at).getTime() > new Date(devis.validated_at).getTime() + 1000;

  const validate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("devis")
        .update({
          validation_client_confirmed: true,
          validation_service_confirmed: true,
          validation_sector_defined: true,
          validation_amount_confirmed: true,
          validation_deadline_defined: true,
          validated_at: new Date().toISOString(),
          validated_by: user?.id ?? null,
        })
        .eq("id", devis.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proposta validada!");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis", devis.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invalidate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("devis")
        .update({ validated_at: null, validated_by: null })
        .eq("id", devis.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Validação removida");
      queryClient.invalidateQueries({ queryKey: ["devis"] });
      queryClient.invalidateQueries({ queryKey: ["devis", devis.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className={cn(isValidated && !staleValidation && "border-green-500/40")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {isValidated && !staleValidation ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          )}
          Validação Comercial
        </CardTitle>
        {isValidated && (
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              staleValidation
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                : "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            Validada em {format(parseISO(devis.validated_at), "dd/MM/yyyy", { locale: ptBR })}
            {validator && ` por ${validator.full_name || validator.email}`}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {staleValidation && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Dados alterados após a validação. Revise e revalide a proposta.</span>
          </div>
        )}

        <div className="space-y-2">
          {ITEMS.map((it) => {
            const checked = !!source?.[it.key];
            const sourceFilled = isFieldFilled(source, it.sourceField);
            return (
              <label
                key={it.key}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 transition-colors",
                  checked ? "bg-green-500/5 border-green-500/30" : "bg-card border-border",
                  editing ? "cursor-pointer hover:bg-accent/50" : "cursor-default",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={!editing}
                  onCheckedChange={(v) => onToggle(it.key, !!v)}
                />
                <span className="flex-1 text-sm font-medium">{it.label}</span>
                {sourceFilled && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30">
                    preenchido
                  </Badge>
                )}
              </label>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>
              {checkedCount}/{ITEMS.length}
            </span>
          </div>
          <Progress value={(checkedCount / ITEMS.length) * 100} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={() => validate.mutate()}
            disabled={!allChecked || validate.isPending || (isValidated && !staleValidation)}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {isValidated && !staleValidation ? "Proposta validada" : "Validar proposta"}
          </Button>
          {isValidated && (
            <Button
              variant="outline"
              onClick={() => invalidate.mutate()}
              disabled={invalidate.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Invalidar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
