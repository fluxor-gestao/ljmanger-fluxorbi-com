import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFxRates, rateFor } from "@/hooks/useFxRates";

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "CAD", "CHF"] as const;

export function CurrencyCell({
  entryId,
  currency,
  exchangeRate,
}: {
  entryId: string;
  currency: string;
  exchangeRate: number;
}) {
  const qc = useQueryClient();
  const { data: rates } = useFxRates();

  const mut = useMutation({
    mutationFn: async (newCurrency: string) => {
      const patch: { currency: string; exchange_rate?: number } = { currency: newCurrency };
      if (newCurrency === "BRL") {
        patch.exchange_rate = 1;
      } else if (!exchangeRate || exchangeRate === 1) {
        const suggested = rateFor(newCurrency, rates);
        if (suggested) patch.exchange_rate = suggested;
      }
      const { error } = await supabase.from("financial_entries").update(patch).eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial-entries"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao alterar moeda"),
  });

  return (
    <Select value={currency || "BRL"} onValueChange={(v) => mut.mutate(v)}>
      <SelectTrigger className="h-7 w-[78px] text-xs px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
