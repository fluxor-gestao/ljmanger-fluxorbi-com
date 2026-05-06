import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  DollarSign,
  FileText,
  Briefcase,
  LayoutDashboard,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/hub")({
  component: Hub,
});

type ModuleItem = {
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  gradient: string;
};

const modules: ModuleItem[] = [
  { title: "Comercial", description: "Clientes e propostas (Devis)", route: "/comercial", icon: FileText, gradient: "from-purple-500 to-purple-700" },
  { title: "Financeiro", description: "Movimentação e fluxo de caixa", route: "/financeiro", icon: DollarSign, gradient: "from-blue-500 to-blue-700" },
  { title: "Operação", description: "Cases e serviços", route: "/operacao", icon: Briefcase, gradient: "from-emerald-600 to-emerald-800" },
  { title: "Gestão", description: "Indicadores e gestão", route: "/gestao", icon: LayoutDashboard, gradient: "from-orange-500 to-orange-700" },
  { title: "BI", description: "Business Intelligence", route: "/bi", icon: BarChart3, gradient: "from-pink-500 to-pink-700" },
];

function ModuleCard({ item }: { item: ModuleItem }) {
  const navigate = useNavigate();
  const Icon = item.icon;
  return (
    <Card
      onClick={() => navigate({ to: item.route })}
      className={`group cursor-pointer min-h-[180px] p-6 border-0 text-white bg-gradient-to-br ${item.gradient} shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between`}
    >
      <Icon className="h-12 w-12 text-white/95" strokeWidth={1.75} />
      <div>
        <h3 className="font-display text-xl font-semibold leading-tight">{item.title}</h3>
        <p className="text-sm text-white/85 mt-1">{item.description}</p>
      </div>
    </Card>
  );
}

function Hub() {
  return (
    <div className="space-y-8">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl md:text-4xl font-bold font-display">Lundgaard Hub</h1>
        <p className="text-muted-foreground mt-1">Sistema Central de Gestão Empresarial</p>
      </div>
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((m) => <ModuleCard key={m.route} item={m} />)}
      </div>
    </div>
  );
}
