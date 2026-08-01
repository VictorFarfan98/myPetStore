import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: number | string }>({
  rows,
  columns,
  emptyMessage = "No hay registros."
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-cloud/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th className="px-4 py-3 font-semibold" key={column.key}>{column.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => <tr className="hover:bg-cloud/30" key={row.id}>{columns.map((column) => <td className="whitespace-nowrap px-4 py-3 text-slate-700" key={column.key}>{column.render(row)}</td>)}</tr>)}
          {!rows.length && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={columns.length}>{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
