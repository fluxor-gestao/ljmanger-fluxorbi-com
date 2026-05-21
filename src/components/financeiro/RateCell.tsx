import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);

export function RateCell({
  entryId,
  currency,
  exchangeRate,
}: {
  entryId: string;
  currency: string;
  exchangeRate: number;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(exchangeRate ?? 1));

  useEffect(() => {
    setVal(String(exchangeRate ?? 1));
  }, [exchangeRate]);

  const mut = useMutation({
    mutationFn: async (n: number) => {
      const { error } = await supabase
        .from("financial_entries")
        .update({ exchange_rate: n })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial-entries"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao alterar taxa"),
  });

  if (currency === "BRL") {
    return <span className="text-xs text-muted-foreground tabular-nums">1,0000</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs tabular-nums hover:underline"
      >
        {fmt(Number(exchangeRate || 1))}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      step="0.0001"
      className="h-7 w-24 text-xs px-2"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = Number(val.replace(",", "."));
        if (n > 0 && n !== exchangeRate) mut.mutate(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setVal(String(exchangeRate));
          setEditing(false);
        }
      }}
    />
  );
}
