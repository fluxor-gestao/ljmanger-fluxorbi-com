export type PageState = {
  page: number; // 0-indexed
  pageSize: number;
};

export const DEFAULT_PAGE_SIZE = 20;

export function rangeFor(page: number, pageSize: number): [number, number] {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}

export function totalPages(total: number, pageSize: number): number {
  if (!total || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

export function pageInfoLabel(page: number, pageSize: number, total: number): string {
  if (!total) return "0 registros";
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return `${from}–${to} de ${total}`;
}
