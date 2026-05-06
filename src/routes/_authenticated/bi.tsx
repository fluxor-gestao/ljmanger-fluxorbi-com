import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/bi")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold font-display">BI</h1>
      <p className="text-muted-foreground">Em construção — em breve Business Intelligence.</p>
    </div>
  ),
});
