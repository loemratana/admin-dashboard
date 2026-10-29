import { ChevronLeft, ChevronRight } from "lucide-react";

type DataTablePaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

const buttonClasses =
  "inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

export function DataTablePagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
}: DataTablePaginationProps) {
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <p>
        Showing {first}–{last} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={buttonClasses}>
          <ChevronLeft className="size-4" />
          Previous
        </button>
        <span className="tabular-nums">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className={buttonClasses}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
