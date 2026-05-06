import logo from "@/assets/logo.svg";

export function LoadingScreen({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <img src={logo} alt="Lundgaard Hub" className="h-16 w-auto opacity-90" />
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
