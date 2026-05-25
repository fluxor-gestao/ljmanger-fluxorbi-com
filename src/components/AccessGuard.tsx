import { useLocation } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessRoute } from "@/lib/access";
import { Button } from "@/components/ui/button";

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { hasRole, roleLoading, roles } = useAuth();

  if (roleLoading) return <>{children}</>; // ainda carregando papéis — não bloqueia render para evitar flicker

  if (canAccessRoute(location.pathname, hasRole)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Acesso restrito</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Você não tem permissão para acessar este módulo.
        {roles.length === 0
          ? " Seu usuário ainda não tem nenhum papel atribuído. Fale com um administrador."
          : " Fale com um administrador caso precise de acesso."}
      </p>
      <Button asChild variant="outline" size="sm">
        <a href="/hub">Voltar ao início</a>
      </Button>
    </div>
  );
}
