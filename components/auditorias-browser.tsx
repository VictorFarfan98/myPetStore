"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { AuditoriaRow, SucursalRow, UsuarioRow } from "@/lib/rpc/types";
import { DataTable } from "./data-table";

const pageSize = 20;
const dateFormatter = new Intl.DateTimeFormat("es-GT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Guatemala"
});

function jsonText(value: Record<string, unknown> | null) {
  return value ? JSON.stringify(value, null, 2) : "";
}

function valuesCell(value: Record<string, unknown> | null, label: string): ReactNode {
  if (!value) return <span className="text-slate-400">—</span>;
  return <details className="max-w-xs"><summary className="cursor-pointer font-semibold text-jade">{label}</summary><pre className="mt-2 max-h-48 max-w-[24rem] overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs text-slate-600">{jsonText(value)}</pre></details>;
}

export function AuditoriasBrowser({ rows, users, branches, date, today, query }: { rows: AuditoriaRow[]; users: UsuarioRow[]; branches: SucursalRow[]; date: string; today: string; query: string }) {
  const [page, setPage] = useState(1);
  const userById = new Map(users.map((user) => [user.id, user]));
  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const normalizedQuery = query.toLocaleLowerCase();
  const visibleRows = rows.filter((row) => {
    if (!normalizedQuery) return true;
    const user = row.usuario_id ? userById.get(row.usuario_id) : undefined;
    const branch = row.sucursal_id ? branchById.get(row.sucursal_id) : undefined;
    return [
      row.id,
      row.tipo_entidad,
      row.entidad_id,
      row.accion,
      row.usuario_id,
      user?.nombre,
      user?.nombre_usuario,
      row.sucursal_id,
      branch?.nombre,
      row.motivo,
      row.creado_en,
      jsonText(row.valores_anteriores),
      jsonText(row.valores_nuevos)
    ].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalizedQuery);
  });
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
    <form action="/auditorias" className="flex flex-col gap-3 lg:flex-row lg:items-end" method="get">
      <label className="block flex-1 text-sm font-medium text-ink" htmlFor="auditorias-search">Buscar auditorías<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" defaultValue={query} id="auditorias-search" name="q" placeholder="Entidad, acción, usuario o motivo" type="search" /></label>
      <label className="block text-sm font-medium text-ink" htmlFor="auditorias-date">Fecha<input className="focus-ring mt-1 rounded-lg border border-slate-300 px-3 py-2.5 font-normal" defaultValue={date} id="auditorias-date" max={today} name="fecha" required type="date" /></label>
      <div className="flex gap-3"><button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2.5 font-semibold text-white" type="submit"><Search className="h-4 w-4" aria-hidden="true" />Buscar</button><button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" name="hoy" type="submit" value="1">Hoy</button>{query && <a className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" href={`/auditorias?fecha=${date}`}>Limpiar</a>}</div>
    </form>
    <div className="mb-5 mt-6"><h2 className="text-xl font-semibold text-ink">Registros del {date}</h2><p className="mt-1 text-sm text-slate-500">{visibleRows.length} de {rows.length} registro{rows.length === 1 ? "" : "s"} encontrado{visibleRows.length === 1 ? "" : "s"}.</p></div>
    <DataTable rows={pageRows} emptyMessage="No hay auditorías que coincidan con la búsqueda." columns={[
      { key: "creado_en", header: "Fecha", render: (row) => dateFormatter.format(new Date(row.creado_en)) },
      { key: "entidad", header: "Entidad", render: (row) => <div><p className="font-semibold text-ink">{row.tipo_entidad}</p><p className="text-xs text-slate-500">ID: {row.entidad_id}</p></div> },
      { key: "accion", header: "Acción", render: (row) => <span className="rounded-full bg-cloud px-2.5 py-1 text-xs font-semibold text-jade">{row.accion}</span> },
      { key: "usuario", header: "Usuario", render: (row) => row.usuario_id ? <div><p>{userById.get(row.usuario_id)?.nombre ?? "Usuario no disponible"}</p><p className="text-xs text-slate-500">{row.usuario_id}</p></div> : "Sistema" },
      { key: "sucursal", header: "Sucursal", render: (row) => row.sucursal_id ? branchById.get(row.sucursal_id)?.nombre ?? `Sucursal #${row.sucursal_id}` : "Global" },
      { key: "motivo", header: "Motivo", render: (row) => row.motivo ?? <span className="text-slate-400">—</span> },
      { key: "anteriores", header: "Valores anteriores", render: (row) => valuesCell(row.valores_anteriores, "Ver valores") },
      { key: "nuevos", header: "Valores nuevos", render: (row) => valuesCell(row.valores_nuevos, "Ver valores") }
    ]} />
    {visibleRows.length > pageSize && <nav aria-label="Paginación visual de auditorías" className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-slate-500">Página {currentPage} de {totalPages}</p><div className="flex gap-2"><button className="focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</button><button className="focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Siguiente<ChevronRight className="h-4 w-4" aria-hidden="true" /> </button></div></nav>}
  </section>;
}
