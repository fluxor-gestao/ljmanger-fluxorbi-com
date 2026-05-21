import { useQuery } from "@tanstack/react-query";

export type FxRate = {
  code: string; // e.g. "USD"
  pair: string; // e.g. "USD-BRL"
  bid: number;
  pctChange: number;
  timestamp: number; // unix seconds
};

const PAIRS = ["USD-BRL", "EUR-BRL", "GBP-BRL", "CAD-BRL", "CHF-BRL"];

async function fetchRates(): Promise<FxRate[]> {
  const url = `https://economia.awesomeapi.com.br/json/last/${PAIRS.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("fx fetch failed");
  const json = await res.json();
  return PAIRS.map((p) => {
    const key = p.replace("-", "");
    const r = json[key];
    if (!r) return null;
    return {
      code: r.code,
      pair: `${r.code}-${r.codein}`,
      bid: Number(r.bid),
      pctChange: Number(r.pctChange),
      timestamp: Number(r.timestamp),
    };
  }).filter(Boolean) as FxRate[];
}

export function useFxRates() {
  return useQuery({
    queryKey: ["fx-rates"],
    queryFn: fetchRates,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function rateFor(code: string, rates: FxRate[] | undefined): number | null {
  if (!rates) return null;
  if (code === "BRL") return 1;
  const r = rates.find((x) => x.code === code);
  return r ? r.bid : null;
}
