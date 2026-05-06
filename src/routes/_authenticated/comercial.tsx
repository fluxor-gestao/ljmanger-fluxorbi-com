import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/comercial")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold font-display">Comercial</h1>
      <p className="text-muted-foreground">Em construção — em breve clientes, propostas e Devis.</p>
    </div>
  ),
});
