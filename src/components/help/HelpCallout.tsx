import { Info, AlertTriangle, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "info" | "warning" | "tip";

const variants: Record<Variant, { icon: LucideIcon; cls: string }> = {
  info: { icon: Info, cls: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300" },
  warning: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" },
  tip: { icon: Lightbulb, cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
};

interface HelpCalloutProps {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
}

export function HelpCallout({ variant = "info", title, children }: HelpCalloutProps) {
  const { icon: Icon, cls } = variants[variant];
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 text-sm", cls)}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="space-y-1 text-foreground/90">
        {title && <div className="font-semibold">{title}</div>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
