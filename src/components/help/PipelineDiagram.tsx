import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineStep = {
  id: string;
  label: string;
  description: string;
  responsible: string;
  tone?: "neutral" | "blue" | "amber" | "violet" | "emerald";
};

const TONES: Record<NonNullable<PipelineStep["tone"]>, string> = {
  neutral: "border-border bg-muted/40 text-foreground",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

interface Props {
  steps: PipelineStep[];
}

export function PipelineDiagram({ steps }: Props) {
  const [active, setActive] = useState<string>(steps[0]?.id ?? "");
  const current = steps.find((s) => s.id === active) ?? steps[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActive(s.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-medium transition-all hover:scale-[1.02]",
                TONES[s.tone ?? "neutral"],
                active === s.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <span className="opacity-60 mr-1">{i + 1}.</span>
              {s.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {current && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Etapa {steps.findIndex((s) => s.id === current.id) + 1} — Responsável: {current.responsible}
          </div>
          <div className="font-semibold text-base mb-1">{current.label}</div>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>
      )}
    </div>
  );
}
