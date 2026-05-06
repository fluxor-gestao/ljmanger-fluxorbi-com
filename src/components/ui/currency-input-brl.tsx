import * as React from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputBRLProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
}

const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toCents = (raw: string | number | null | undefined): number => {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
};

/**
 * Input monetário pt-BR. Mostra "100.000,00" enquanto o usuário digita,
 * e propaga o valor numérico (string) para o formulário.
 */
export const CurrencyInputBRL = React.forwardRef<HTMLInputElement, CurrencyInputBRLProps>(
  ({ value, onChange, placeholder = "0,00", ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(() => formatCents(toCents(value)));

    React.useEffect(() => {
      const cents = toCents(value);
      const next = formatCents(cents);
      // só atualiza se diferente para não atrapalhar a digitação
      setDisplay((prev) => (prev === next ? prev : next));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      const cents = digits === "" ? 0 : parseInt(digits, 10);
      setDisplay(formatCents(cents));
      onChange((cents / 100).toFixed(2));
    };

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  },
);
CurrencyInputBRL.displayName = "CurrencyInputBRL";
