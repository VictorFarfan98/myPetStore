"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServicioRow } from "@/lib/rpc/types";
import { createServicio, deleteServicio, updateServicio } from "@/lib/servicios-actions";
import { DataTable } from "./data-table";

const emptyForm = { id: "", nombre: "", intervalo_recordatorio_dias: "", duracion_minutos: "", precio: "", activo: true };

export function ServiciosBrowser({ rows, additional = false }: { rows: ServicioRow[]; additional?: boolean }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(form.id);
  const visibleRows = rows.filter((row) => row.es_adicional === additional);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = editing ? await updateServicio(data) : await createServicio(data);
      if (result.error) return setMessage({ text: result.error, error: true });
      setForm(emptyForm);
      setMessage({ text: editing ? "Servicio actualizado." : "Servicio creado.", error: false });
      router.refresh();
    });
  }

  function remove(id: number) {
    if (!window.confirm("¿Deseas desactivar este servicio?")) return;
    const data = new FormData();
    data.set("id", String(id));
    startTransition(async () => {
      const result = await deleteServicio(data);
      setMessage({ text: result.error ?? "Servicio desactivado.", error: Boolean(result.error) });
      if (!result.error) router.refresh();
    });
  }

  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-5"><h2 className="text-xl font-semibold text-ink">{additional ? "Servicios adicionales" : "Servicios principales"}</h2><p className="mt-1 text-sm text-slate-500">{visibleRows.length} servicio{visibleRows.length === 1 ? "" : "s"} registrado{visibleRows.length === 1 ? "" : "s"}.</p></div>
        <DataTable rows={visibleRows} columns={[
          { key: "nombre", header: "Nombre", render: (row) => <span className="font-semibold text-ink">{row.nombre}</span> },
          ...(!additional ? [{ key: "duracion", header: "Duración", render: (row: ServicioRow) => row.duracion_minutos ? `${row.duracion_minutos} min` : "Por especie y tamaño" }] : []),
          ...(additional ? [{ key: "precio", header: "Precio", render: (row: ServicioRow) => row.precio !== null ? `Q ${Number(row.precio).toFixed(2)}` : "—" }] : []),
          { key: "estado", header: "Estado", render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{row.activo ? "Activo" : "Inactivo"}</span> },
          { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => setForm({ id: String(row.id), nombre: row.nombre, intervalo_recordatorio_dias: row.intervalo_recordatorio_dias ? String(row.intervalo_recordatorio_dias) : "", duracion_minutos: row.duracion_minutos ? String(row.duracion_minutos) : "", precio: row.precio ?? "", activo: row.activo })} type="button">Editar</button><button className="font-semibold text-red-700 hover:underline" onClick={() => remove(row.id)} type="button">Eliminar</button></div> }
        ]} />
      </div>
      <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
        <h2 className="text-xl font-semibold text-ink">{editing ? "Editar servicio" : additional ? "Nuevo servicio adicional" : "Nuevo servicio principal"}</h2>
        <div className="mt-5 space-y-4">
          <input name="id" type="hidden" value={form.id} />
          {additional && <input name="es_adicional" type="hidden" value="on" />}
          <label className="block text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="nombre" onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
          <label className="block text-sm font-medium text-ink">Intervalo de recordatorio (días)<span className="mt-1 block text-xs font-normal text-slate-500">Opcional. Se usa para recordatorios posteriores al servicio.</span><input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="intervalo_recordatorio_dias" onChange={(event) => setForm({ ...form, intervalo_recordatorio_dias: event.target.value })} type="number" value={form.intervalo_recordatorio_dias} /></label>
          {!additional && <label className="block text-sm font-medium text-ink">Duración general (minutos)<span className="mt-1 block text-xs font-normal text-slate-500">Se usa al agendar una cita.</span><input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="duracion_minutos" onChange={(event) => setForm({ ...form, duracion_minutos: event.target.value })} required type="number" value={form.duracion_minutos} /></label>}
          {additional && <label className="block text-sm font-medium text-ink">Precio (GTQ)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="0" name="precio" onChange={(event) => setForm({ ...form, precio: event.target.value })} required step="0.01" type="number" value={form.precio} /></label>}
          <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={form.activo} name="activo" onChange={(event) => setForm({ ...form, activo: event.target.checked })} type="checkbox" /> Servicio activo</label>
          {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
          <div className="flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear servicio"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" onClick={() => setForm(emptyForm)} type="button">Cancelar</button>}</div>
        </div>
      </form>
    </section>
  );
}
