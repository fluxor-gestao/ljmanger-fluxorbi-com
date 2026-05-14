import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpHero } from "@/components/help/HelpHero";
import { HelpCallout } from "@/components/help/HelpCallout";
import { PipelineDiagram } from "@/components/help/PipelineDiagram";
import { HowToAccordion } from "@/components/help/HowToAccordion";
import { HelpFAQ } from "@/components/help/HelpFAQ";
import {
  comercialOverview,
  comercialPipeline,
  comercialHowTo,
  comercialFAQ,
} from "@/content/help/comercial";

function AjudaComercial() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" asChild size="sm">
          <Link to="/ajuda">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à Central de Ajuda
          </Link>
        </Button>
        <Button variant="outline" asChild size="sm">
          <Link to="/comercial">Ir para o Comercial</Link>
        </Button>
      </div>

      <HelpHero
        icon={ShoppingCart}
        title="Módulo Comercial"
        subtitle="Tudo o que você precisa saber para operar clientes, propostas, envio e aceite."
      />

      {/* A. Visão geral */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Visão geral</h2>
        <div className="space-y-2">
          {comercialOverview.map((line, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* B. Fluxo visual */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Fluxo do pipeline</h2>
        <p className="text-sm text-muted-foreground">
          Clique em qualquer etapa para ver o que acontece e quem é o responsável.
        </p>
        <PipelineDiagram steps={comercialPipeline} />
        <HelpCallout variant="tip" title="Dica">
          As etapas em <strong>roxo</strong> e <strong>verde</strong> são acionadas
          automaticamente pelo sistema. Você só precisa mover cards no Kanban entre
          'Entrada recebida' e 'Enviado para operação'.
        </HelpCallout>
      </section>

      {/* C. Passo a passo */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Como eu faço para…</h2>
        <p className="text-sm text-muted-foreground">
          Tarefas práticas do dia a dia. Clique para expandir cada uma.
        </p>
        <HowToAccordion items={comercialHowTo} />
      </section>

      {/* D. FAQ */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Perguntas frequentes</h2>
        <HelpFAQ items={comercialFAQ} />
      </section>

      <HelpCallout variant="info" title="Não encontrou sua dúvida?">
        Fale com o time técnico ou a gerência comercial. Esta página é viva e novas
        perguntas frequentes são adicionadas conforme a operação evolui.
      </HelpCallout>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/ajuda/comercial")({
  component: AjudaComercial,
});
