import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, DollarSign, Settings2, Building2, BarChart3, Shield, Home, ArrowLeftRight, HelpCircle } from "lucide-react";
import { HelpHero } from "@/components/help/HelpHero";
import { ModuleCard } from "@/components/help/ModuleCard";

const modules = [
  { icon: ShoppingCart, title: "Comercial", description: "Clientes, propostas (devis), envio, aceite e cobrança automática.", to: "/ajuda/comercial", available: true },
  { icon: DollarSign, title: "Financeiro", description: "Receitas, despesas, lançamentos e acompanhamento de entradas.", available: false },
  { icon: ArrowLeftRight, title: "Conciliação", description: "Importação de extratos e conciliação bancária.", available: false },
  { icon: Settings2, title: "Operação", description: "Serviços contratados em execução pela equipe.", available: false },
  { icon: Building2, title: "Gestão", description: "Visão executiva e indicadores gerenciais.", available: false },
  { icon: BarChart3, title: "BI", description: "Relatórios e painéis de Business Intelligence.", available: false },
  { icon: Home, title: "Hub", description: "Tela inicial com atalhos para todos os módulos.", available: false },
  { icon: Shield, title: "Admin", description: "Usuários, permissões e configurações do sistema.", available: false },
];

function AjudaIndex() {
  return (
    <div className="space-y-6">
      <HelpHero
        icon={HelpCircle}
        title="Central de Ajuda"
        subtitle="Aprenda a operar cada módulo do sistema. Escolha um módulo abaixo para ver o passo a passo, o fluxo e as dúvidas frequentes."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <ModuleCard key={m.title} {...m} />
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaIndex,
});
