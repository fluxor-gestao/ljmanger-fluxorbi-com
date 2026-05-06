import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Check, X, CheckCheck } from "lucide-react";

export type AISuggestions = {
  service_type: string;
  responsible_sector: string;
  scope_description: string;
  proposal_structure: string;
};

type FieldKey = keyof AISuggestions;

const FIELD_META: { key: FieldKey; label: string; rows?: number; type: "input" | "textarea" }[] = [
  { key: "service_type", label: "Tipo de serviço", type: "input" },
  { key: "responsible_sector", label: "Setor responsável", type: "input" },
  { key: "scope_description", label: "Descrição do escopo", type: "textarea", rows: 5 },
  { key: "proposal_structure", label: "Estrutura da proposta", type: "textarea", rows: 8 },
];

interface Props {
  suggestions: AISuggestions;
  onAccept: (key: FieldKey, value: string) => void;
  onAcceptAll: (values: AISuggestions) => void;
  onDismiss: () => void;
}

export default function AISuggestionsBlock({ suggestions, onAccept, onAcceptAll, onDismiss }: Props) {
  const [draft, setDraft] = useState<AISuggestions>(suggestions);
  const [accepted, setAccepted] = useState<Record<FieldKey, boolean>>({
    service_type: false,
    responsible_sector: false,
    scope_description: false,
    proposal_structure: false,
  });

  const handleAccept = (key: FieldKey) => {
    onAccept(key, draft[key]);
    setAccepted((s) => ({ ...s, [key]: true }));
  };

  const handleAcceptAll = () => {
    onAcceptAll(draft);
    setAccepted({ service_type: true, responsible_sector: true, scope_description: true, proposal_structure: true });
  };

  return (
    <Card className="border-primary/40 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-primary">Sugestões da IA</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleAcceptAll}>
            <CheckCheck className="h-4 w-4 mr-1" /> Aceitar todas
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X className="h-4 w-4 mr-1" /> Descartar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Edite livremente e clique em "Aceitar" para aplicar ao formulário. Nada é salvo até você clicar em "Salvar".
      </p>

      {FIELD_META.map((f) => (
        <div key={f.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{f.label}</Label>
            <Button
              size="sm"
              variant={accepted[f.key] ? "secondary" : "outline"}
              onClick={() => handleAccept(f.key)}
            >
              <Check className="h-3 w-3 mr-1" /> {accepted[f.key] ? "Aceito" : "Aceitar"}
            </Button>
          </div>
          {f.type === "input" ? (
            <Input
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          ) : (
            <Textarea
              rows={f.rows}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              className="font-mono text-xs"
            />
          )}
        </div>
      ))}
    </Card>
  );
}
