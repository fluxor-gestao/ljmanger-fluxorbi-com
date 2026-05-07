import logo from "@/assets/logo.svg";

export function LoadingScreen({ message = "Abrindo sistema..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img src={logo} alt="Lundgaard Jensen" className="h-auto w-[260px] opacity-95" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
