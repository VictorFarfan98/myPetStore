"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import type { ClienteRow, EmailNotificationRow } from "@/lib/rpc/types";
import { retryEmailNotification } from "@/lib/notificaciones-email-actions";
import { DataTable } from "./data-table";

const dateFormatter = new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guatemala" });
const statusLabels = { pending: "Pendiente", sent: "Enviado", failed: "Fallido" } as const;

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function errorLabel(value: string | null) {
  if (!value) return "—";
  if (value === "recipient_email_missing") return "Cliente sin correo válido";
  if (value === "email_provider_not_configured") return "Proveedor de correo no configurado";
  return "No se pudo enviar el correo";
}

export function EmailHistoryBrowser({ rows, customers, page, pageSize, total, initialFrom, initialTo, initialCustomerId, initialCustomerQuery }: { rows: EmailNotificationRow[]; customers: ClienteRow[]; page: number; pageSize: number; total: number; initialFrom: string; initialTo: string; initialCustomerId: number | null; initialCustomerQuery: string }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const query = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) });
    if (initialFrom) params.set("desde", initialFrom);
    if (initialTo) params.set("hasta", initialTo);
    if (initialCustomerId) params.set("cliente_id", String(initialCustomerId));
    if (initialCustomerQuery) params.set("cliente_q", initialCustomerQuery);
    return `/correos?${params}`;
  };

  function retry(id: number) {
    setRetryingId(id); setMessage(null);
    const formData = new FormData(); formData.set("id", String(id));
    startTransition(async () => {
      const result = await retryEmailNotification(formData);
      setRetryingId(null);
      setMessage(result.error ? { text: result.error, error: true } : { text: "Correo reenviado correctamente.", error: false });
      router.refresh();
    });
  }

  return <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
    <form action="/correos" className="grid gap-3 lg:grid-cols-[12rem_12rem_minmax(16rem,1fr)_14rem_auto] lg:items-end" method="get">
      <input name="page" type="hidden" value="1" />
      <label className="grid gap-1 text-sm font-medium text-ink">Desde<input className="focus-ring rounded-lg border border-slate-300 px-3 py-2 font-normal" defaultValue={initialFrom} name="desde" type="date" /></label>
      <label className="grid gap-1 text-sm font-medium text-ink">Hasta<input className="focus-ring rounded-lg border border-slate-300 px-3 py-2 font-normal" defaultValue={initialTo} name="hasta" type="date" /></label>
      <label className="grid gap-1 text-sm font-medium text-ink">Buscar cliente<input className="focus-ring rounded-lg border border-slate-300 px-3 py-2 font-normal" defaultValue={initialCustomerQuery} name="cliente_q" placeholder="Nombre, teléfono o mascota" type="search" /></label>
      <label className="grid gap-1 text-sm font-medium text-ink">Cliente<select className="focus-ring rounded-lg border border-slate-300 px-3 py-2 font-normal" defaultValue={initialCustomerId ?? ""} name="cliente_id"><option value="">Todos los clientes</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nombre}</option>)}</select></label>
      <div className="flex gap-2"><button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 font-semibold text-white" type="submit"><Search className="h-4 w-4" aria-hidden="true" />Filtrar</button><a className="focus-ring rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700" href="/correos">Limpiar</a></div>
    </form>
    {message && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
    <div className="mt-6" aria-busy={pending}><DataTable rows={rows} emptyMessage="No hay notificaciones para los filtros seleccionados." columns={[
      { key: "cliente", header: "Cliente / destinatario", render: (row) => <div><p className="font-semibold text-ink">{row.cliente_nombre}</p><p className="text-xs text-slate-500">{row.destinatario ?? "Sin correo válido"}</p></div> },
      { key: "servicio", header: "Mascota / servicio", render: (row) => <div><p className="font-semibold text-ink">{row.mascota_nombre}</p><p className="text-xs text-slate-500">{row.servicio_nombre} · {row.sucursal_nombre}</p></div> },
      { key: "tipo", header: "Tipo / proveedor", render: (row) => <div><p>{row.tipo_notificacion === "service_completed" ? "Servicio completado" : row.tipo_notificacion}</p><p className="text-xs text-slate-500">{row.proveedor}</p></div> },
      { key: "estado", header: "Estado", render: (row) => <div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.estado === "sent" ? "bg-emerald-100 text-emerald-800" : row.estado === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{statusLabels[row.estado]}</span><p className="mt-1 text-xs text-slate-500">{row.intentos} intento{row.intentos === 1 ? "" : "s"}</p></div> },
      { key: "fechas", header: "Fechas", render: (row) => <div><p>Creado: {formatDate(row.creado_en)}</p><p className="text-xs text-slate-500">Enviado: {formatDate(row.enviado_en)}</p></div> },
      { key: "error", header: "Último error", render: (row) => <span className="max-w-48 whitespace-normal text-xs">{errorLabel(row.ultimo_error)}</span> },
      { key: "accion", header: "Acción", render: (row) => row.estado === "failed" && row.ultimo_error !== "recipient_email_missing" ? <button className="focus-ring inline-flex items-center gap-1 font-semibold text-jade hover:underline disabled:opacity-50" disabled={pending} onClick={() => retry(row.id)} type="button">{retryingId === row.id && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{retryingId === row.id ? "Reintentando..." : "Reintentar"}</button> : "—" }
    ]} /></div>
    {totalPages > 1 && <nav aria-label="Paginación del historial de correos" className="mt-5 flex items-center justify-between"><a className={`focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={query(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Anterior</a><span className="text-sm text-slate-500">Página {page} de {totalPages}</span><a className={`focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={query(page + 1)}>Siguiente<ChevronRight className="h-4 w-4" aria-hidden="true" /></a></nav>}
  </section>;
}
