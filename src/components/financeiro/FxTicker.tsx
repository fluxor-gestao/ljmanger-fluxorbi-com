import { useFxRates } from "@/hooks/useFxRates";
import { TrendingUp, TrendingDown } from "lucide-react";

const fmtRate = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function FxTicker() {
  const { data, isLoading } = useFxRates();
  if (isLoading || !data) {
    return (
      <div className="h-8 bg-muted/40 rounded-md flex items-center px-3 text-xs text-muted-foreground">
        Carregando cotações…
      </div>
    );
  }
  // Duplicate for seamless marquee
  const items = [...data, ...data];
  return (
    <div className="h-8 overflow-hidden rounded-md border bg-muted/30 relative">
      <div className="flex gap-8 px-3 items-center h-full whitespace-nowrap animate-fx-marquee">
        {items.map((r, i) => {
          const up = r.pctChange >= 0;
          return (
            <div key={`${r.pair}-${i}`} className="flex items-center gap-2 text-xs tabular-nums">
              <span className="font-semibold">{r.pair}</span>
              <span>R$ {fmtRate(r.bid)}</span>
              <span className={up ? "text-success flex items-center gap-0.5" : "text-destructive flex items-center gap-0.5"}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{r.pctChange.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">{fmtTime(r.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
