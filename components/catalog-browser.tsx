"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";

type Row = { id: number; nombre: string; especie?: "perro" | "gato" | "otro"; activo: boolean };
type Action = (formData: FormData) => Promise<{ ok?: boolean; error?: string }>;

export function CatalogBrowser({
  rows,
  title,
  singular,
  create,
  update,
  remove,
  speciesCatalog = false
}: {
  rows: Row[];
  title: string;
  singular: string;
  create: Action;
  update: Action;
  remove: Action;
  speciesCatalog?: boolean;
}) {
  const [form, setForm] = useState({ id: "", nombre: "", especie: "perro" as "perro" | "gato" | "otro", activo: true });
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setEditing(false);
    setForm({ id: "", nombre: "", especie: "perro", activo: true });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await (editing ? update : create)(data);
      if (result.error) return setMessage({ text: result.error, error: true });
      const text = editing ? `${singular} actualizado.` : `${singular} creado.`;
      reset();
      setMessage({ text, error: false });
      router.refresh();
    });
  }

  function deleteRow(id: number) {
    if (!window.confirm(`¿Deseas desactivar ${singular.toLowerCase()}?`)) return;
    const data = new FormData();
    data.set("id", String(id));
    startTransition(async () => {
      const result = await remove(data);
      setMessage({ text: result.error ?? `${singular} desactivado.`, error: Boolean(result.error) });
      if (!result.error) router.refresh();
    });
  }

  return <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5"><h2 className="text-xl font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-slate-500">Administra los registros disponibles.</p></div>
      <DataTable rows={rows} columns={[
        { key: "nombre", header: "Nombre", render: (row) => <span className="font-semibold text-ink">{row.nombre}</span> },
        ...(speciesCatalog ? [{ key: "especie", header: "Especie", render: (row: Row) => row.especie === "gato" ? "Gato" : row.especie === "otro" ? "Otro" : "Perro" }] : []),
        { key: "estado", header: "Estado", render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{row.activo ? "Activo" : "Inactivo"}</span> },
        { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => { setEditing(true); setForm({ id: String(row.id), nombre: row.nombre, especie: row.especie ?? "perro", activo: row.activo }); }} type="button">Editar</button><button className="font-semibold text-red-700 hover:underline" onClick={() => deleteRow(row.id)} type="button">Eliminar</button></div> }
      ]} />
    </div>
    <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
      <h2 className="text-xl font-semibold text-ink">{editing ? `Editar ${singular.toLowerCase()}` : `Nuevo ${singular.toLowerCase()}`}</h2>
      <div className="mt-5 space-y-4">
        <input name="id" type="hidden" value={form.id} />
        {speciesCatalog && <label className="block text-sm font-medium text-ink">Especie<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" disabled={editing} name="especie" onChange={(event) => setForm({ ...form, especie: event.target.value as "perro" | "gato" | "otro" })} required value={form.especie}><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select>{editing && <input name="especie" type="hidden" value={form.especie} />}</label>}
        <label className="block text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="nombre" onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={form.activo} name="activo" onChange={(event) => setForm({ ...form, activo: event.target.checked })} type="checkbox" /> Registro activo</label>
        {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
        <div className="flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" onClick={reset} type="button">Cancelar</button>}</div>
      </div>
    </form>
  </section>;
}
