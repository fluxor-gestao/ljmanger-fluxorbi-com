import type { AppRole } from "@/contexts/AuthContext";

/**
 * Matriz de acesso: rota → papéis permitidos.
 * Admin sempre tem acesso (resolvido no `hasRole`).
 */
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/hub": ["admin", "comercial", "financeiro", "operacao"],
  "/comercial": ["comercial"],
  "/financeiro": ["financeiro"],
  "/operacao": ["operacao"],
  "/conciliacao": ["financeiro"],
  "/bi": ["comercial", "financeiro", "operacao"],
  "/gestao": ["admin"],
  "/admin": ["admin"],
  "/ajuda": ["admin", "comercial", "financeiro", "operacao"],
};

export function canAccessRoute(pathname: string, hasRole: (r: AppRole | AppRole[]) => boolean): boolean {
  // Match por prefixo para sub-rotas (/comercial/devis/...)
  const match = Object.keys(ROUTE_ACCESS)
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!match) return true; // rotas não mapeadas → liberar
  return hasRole(ROUTE_ACCESS[match]);
}
