export type DataTableColumn<TRow> = {
  id: string;
  header: React.ReactNode;
  cell: (row: TRow) => React.ReactNode;
  className?: string;
};

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {children}
    </div>
  );
}

export function DataTableToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
      {children}
    </div>
  );
}

type DataTableContentProps<TRow> = {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowId: (row: TRow) => string;
  emptyState?: React.ReactNode;
};

export function DataTableContent<TRow>({
  columns,
  rows,
  getRowId,
  emptyState = <DataTableEmpty title="No results" />,
}: DataTableContentProps<TRow>) {
  return (
    // relative: keeps absolutely positioned content (e.g. sr-only labels) inside the scroll area.
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`px-4 py-3 font-medium whitespace-nowrap ${column.className ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyState}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowId(row)} className="hover:bg-muted/50">
                {columns.map((column) => (
                  <td key={column.id} className={`px-4 py-3 whitespace-nowrap ${column.className ?? ""}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type DataTableEmptyProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function DataTableEmpty({ title, description, action }: DataTableEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
