import { type LucideIcon } from "lucide-react";

interface HelpHeroProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export function HelpHero({ icon: Icon, title, subtitle }: HelpHeroProps) {
  return (
    <div className="flex items-start gap-4 border-b pb-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-3xl font-bold font-display">{title}</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
