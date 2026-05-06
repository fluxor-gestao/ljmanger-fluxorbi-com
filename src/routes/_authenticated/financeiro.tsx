import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold font-display">Financeiro</h1>
      <p className="text-muted-foreground">Em construção — em breve movimentação e fluxo de caixa.</p>
    </div>
  ),
});
