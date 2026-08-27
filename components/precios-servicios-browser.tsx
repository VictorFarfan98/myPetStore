"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PrecioServicioRow, ServicioRow, TamanoRow } from "@/lib/rpc/types";
import { createPrecioServicio, deletePrecioServicio, updatePrecioServicio } from "@/lib/precios-servicios-actions";
import { DataTable } from "./data-table";

type Props = { rows: PrecioServicioRow[]; services: ServicioRow[]; sizes: TamanoRow[] };
type Form = { servicio_id: string; especie: string; tamano_id: string; precio: string; precio_promocional: string; duracion_minutos: string; activo: boolean };
const emptyForm: Form = { servicio_id: "", especie: "perro", tamano_id: "", precio: "", precio_promocional: "", duracion_minutos: "", activo: true };

export function PreciosServiciosBrowser({ rows, services, sizes }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const primaryServices = services.filter((service) => !service.es_adicional);
  const visibleRows = rows.filter((row) => primaryServices.some((service) => service.id === row.servicio_id));
  const serviceName = (id: number) => primaryServices.find((service) => service.id === id)?.nombre ?? `Servicio #${id}`;
  const sizeName = (id: number) => sizes.find((size) => size.id === id)?.nombre ?? `Tamaño #${id}`;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = editing ? await updatePrecioServicio(data) : await createPrecioServicio(data);
      if (result.error) return setMessage({ text: result.error, error: true });
      setForm(emptyForm);
      setEditing(false);
      setMessage({ text: editing ? "Precio actualizado." : "Precio creado.", error: false });
      router.refresh();
    });
  }

  function remove(row: PrecioServicioRow) {
    if (!window.confirm("¿Deseas desactivar este precio?")) return;
    const data = new FormData();
    data.set("servicio_id", String(row.servicio_id));
    data.set("especie", row.especie);
    data.set("tamano_id", String(row.tamano_id));
    startTransition(async () => {
      const result = await deletePrecioServicio(data);
      setMessage({ text: result.error ?? "Precio desactivado.", error: Boolean(result.error) });
      if (!result.error) router.refresh();
    });
  }

  return <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5"><h2 className="text-xl font-semibold text-ink">Precios y duración por especie y tamaño</h2><p className="mt-1 text-sm text-slate-500">Configura el precio y tiempo estimado de cada servicio.</p></div>
      <DataTable rows={visibleRows.map((row) => ({ ...row, id: `${row.servicio_id}-${row.especie}-${row.tamano_id}` }))} columns={[
        { key: "servicio", header: "Servicio", render: (row) => <span className="font-semibold text-ink">{serviceName(row.servicio_id)}</span> },
        { key: "especie", header: "Especie", render: (row) => row.especie === "perro" ? "Perro" : row.especie === "gato" ? "Gato" : "Otro" },
        { key: "tamano", header: "Clasificación", render: (row) => sizeName(row.tamano_id) },
        { key: "precio", header: "Precio", render: (row) => `Q ${Number(row.precio).toFixed(2)}` },
        { key: "promo", header: "Promo", render: (row) => row.precio_promocional ? `Q ${Number(row.precio_promocional).toFixed(2)}` : "—" },
        { key: "duracion", header: "Duración", render: (row) => `${row.duracion_minutos} min` },
        { key: "estado", header: "Estado", render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{row.activo ? "Activo" : "Inactivo"}</span> },
        { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => { setEditing(true); setForm({ servicio_id: String(row.servicio_id), especie: row.especie, tamano_id: String(row.tamano_id), precio: row.precio, precio_promocional: row.precio_promocional ?? "", duracion_minutos: String(row.duracion_minutos), activo: row.activo }); }} type="button">Editar</button><button className="font-semibold text-red-700 hover:underline" onClick={() => remove(row)} type="button">Eliminar</button></div> }
      ]} />
    </div>
    <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
      <h2 className="text-xl font-semibold text-ink">{editing ? "Editar precio" : "Nuevo precio"}</h2>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-medium text-ink">Servicio<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={editing} name="servicio_id" onChange={(event) => setForm({ ...form, servicio_id: event.target.value })} required value={form.servicio_id}><option value="">Selecciona un servicio</option>{primaryServices.map((service) => <option key={service.id} value={service.id}>{service.nombre}{service.activo ? "" : " (inactivo)"}</option>)}</select>{editing && <input name="servicio_id" type="hidden" value={form.servicio_id} />}</label>
        <label className="block text-sm font-medium text-ink">Especie<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={editing} name="especie" onChange={(event) => setForm({ ...form, especie: event.target.value })} required value={form.especie}><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select>{editing && <input name="especie" type="hidden" value={form.especie} />}</label>
        <label className="block text-sm font-medium text-ink">Clasificación<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={editing} name="tamano_id" onChange={(event) => setForm({ ...form, tamano_id: event.target.value })} required value={form.tamano_id}><option value="">Selecciona una clasificación</option>{sizes.filter((size) => size.especie === form.especie).map((size) => <option key={size.id} value={size.id}>{size.nombre}{size.activo ? "" : " (inactivo)"}</option>)}</select>{editing && <input name="tamano_id" type="hidden" value={form.tamano_id} />}</label>
        <label className="block text-sm font-medium text-ink">Precio (GTQ)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="0" name="precio" onChange={(event) => setForm({ ...form, precio: event.target.value })} required step="0.01" type="number" value={form.precio} /></label>
        <label className="block text-sm font-medium text-ink">Precio promocional (GTQ)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="0" name="precio_promocional" onChange={(event) => setForm({ ...form, precio_promocional: event.target.value })} step="0.01" type="number" value={form.precio_promocional} /></label>
        <label className="block text-sm font-medium text-ink">Duración (minutos)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" min="1" name="duracion_minutos" onChange={(event) => setForm({ ...form, duracion_minutos: event.target.value })} required step="1" type="number" value={form.duracion_minutos} /></label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={form.activo} name="activo" onChange={(event) => setForm({ ...form, activo: event.target.checked })} type="checkbox" /> Precio activo</label>
        {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
        <div className="flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear precio"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" onClick={() => { setEditing(false); setForm(emptyForm); }} type="button">Cancelar</button>}</div>
      </div>
    </form>
  </section>;
}
