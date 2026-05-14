import { Link } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  to?: string;
  available: boolean;
}

export function ModuleCard({ icon: Icon, title, description, to, available }: Props) {
  const content = (
    <Card
      className={cn(
        "p-5 h-full flex flex-col gap-3 transition-all",
        available
          ? "hover:border-primary hover:shadow-md cursor-pointer"
          : "opacity-60 cursor-not-allowed"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant={available ? "default" : "secondary"}>
          {available ? "Disponível" : "Em breve"}
        </Badge>
      </div>
      <div>
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </Card>
  );

  if (available && to) {
    return (
      <Link to={to} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}
