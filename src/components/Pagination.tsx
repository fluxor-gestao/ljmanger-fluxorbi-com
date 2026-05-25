import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageInfoLabel, totalPages } from "@/lib/pagination";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function Pagination({ page, pageSize, total, onPageChange, disabled }: Props) {
  const pages = totalPages(total, pageSize);
  const canPrev = page > 0 && !disabled;
  const canNext = page + 1 < pages && !disabled;

  return (
    <div className="flex items-center justify-between gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{pageInfoLabel(page, pageSize, total)}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <span className="text-muted-foreground">
          {pages === 0 ? "–" : `${page + 1} / ${pages}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
