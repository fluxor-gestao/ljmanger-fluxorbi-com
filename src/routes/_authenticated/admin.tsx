import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold font-display">Admin</h1>
      <p className="text-muted-foreground">Em construção — em breve gestão de usuários e API keys.</p>
    </div>
  ),
});
