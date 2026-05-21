import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";

type Row = {
  currency: string;
  original_amount: number | null;
  total_brl: number | null;
  amount_in: number | null;
  amount_out: number | null;
  entry_type: string | null;
};

const symbols: Record<string, string> = {
  BRL: "R$", USD: "$", EUR: "€", GBP: "£", CAD: "C$", CHF: "CHF",
};

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtNum = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function CurrencySummary({ rows }: { rows: Row[] }) {
  const groups = new Map<
    string,
    { inOrig: number; outOrig: number; totalBrl: number }
  >();
  rows.forEach((r) => {
    if (r.entry_type === "transferencia") return;
    const cur = r.currency || "BRL";
    if (!groups.has(cur)) groups.set(cur, { inOrig: 0, outOrig: 0, totalBrl: 0 });
    const g = groups.get(cur)!;
    const orig = Number(r.original_amount ?? 0);
    const inAmt = Number(r.amount_in ?? 0);
    const outAmt = Number(r.amount_out ?? 0);
    // distribute by direction
    if (inAmt > 0) g.inOrig += orig || inAmt;
    if (outAmt > 0) g.outOrig += orig || outAmt;
    const brl = Number(r.total_brl ?? 0);
    g.totalBrl += (inAmt > 0 ? brl : 0) - (outAmt > 0 ? brl : 0);
  });

  const entries = Array.from(groups.entries()).sort();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Coins className="h-4 w-4 mr-2" /> Resumo por moeda
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px]">
        <div className="space-y-2">
          <p className="text-sm font-semibold mb-2">Resumo por moeda</p>
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem lançamentos.</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="grid grid-cols-4 gap-2 font-semibold text-muted-foreground border-b pb-1">
                <span>Moeda</span>
                <span className="text-right">Entradas</span>
                <span className="text-right">Saídas</span>
                <span className="text-right">Total BRL</span>
              </div>
              {entries.map(([cur, g]) => {
                const sym = symbols[cur] ?? cur;
                return (
                  <div key={cur} className="grid grid-cols-4 gap-2 tabular-nums py-1">
                    <span className="font-semibold">{cur}</span>
                    <span className="text-right text-success">{sym} {fmtNum(g.inOrig)}</span>
                    <span className="text-right text-destructive">{sym} {fmtNum(g.outOrig)}</span>
                    <span className="text-right font-semibold">{fmtBRL(g.totalBrl)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
