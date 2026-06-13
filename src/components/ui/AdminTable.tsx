import { cn } from "@/lib/cn";

export interface AdminTableColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export function AdminTable<T>({
  rows,
  columns,
  rowKey,
  emptyLabel = "No items",
}: {
  rows: T[];
  columns: AdminTableColumn<T>[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-10 text-center text-sm text-text-muted">
        {emptyLabel}
      </div>
    );
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-text-muted">
          {columns.map((c) => (
            <th key={c.header} scope="col" className={cn("px-3 py-2 font-medium", c.className)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-border/50">
            {columns.map((c) => (
              <td key={c.header} className={cn("px-3 py-2 text-text", c.className)}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
