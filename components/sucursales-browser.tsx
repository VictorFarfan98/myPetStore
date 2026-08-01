"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SucursalRow } from "@/lib/rpc/types";
import { createSucursal, deleteSucursal, updateSucursal } from "@/lib/sucursales-actions";
import { DataTable } from "./data-table";

const emptyForm = { id: "", nombre: "", direccion: "", telefono: "", activo: true };

export function SucursalesBrowser({ rows }: { rows: SucursalRow[] }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(form.id);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = editing ? await updateSucursal(data) : await createSucursal(data);
      if (result.error) return setMessage(result.error);
      setForm(emptyForm);
      setMessage(editing ? "Sucursal actualizada." : "Sucursal creada.");
      router.refresh();
    });
  }

  function remove(id: number) {
    if (!window.confirm("¿Deseas desactivar esta sucursal?")) return;
    const data = new FormData();
    data.set("id", String(id));
    startTransition(async () => {
      const result = await deleteSucursal(data);
      setMessage(result.error ?? "Sucursal eliminada.");
      if (!result.error) router.refresh();
    });
  }

  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-5"><h2 className="text-xl font-semibold text-ink">Sucursales activas</h2><p className="mt-1 text-sm text-slate-500">{rows.length} registro{rows.length === 1 ? "" : "s"} disponible{rows.length === 1 ? "" : "s"}.</p></div>
        <DataTable rows={rows} columns={[
          { key: "nombre", header: "Nombre", render: (row) => <span className="font-semibold text-ink">{row.nombre}</span> },
          { key: "direccion", header: "Dirección", render: (row) => row.direccion },
          { key: "telefono", header: "Teléfono", render: (row) => row.telefono },
          { key: "estado", header: "Estado", render: (row) => <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{row.activo ? "Activa" : "Inactiva"}</span> },
          { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => setForm({ id: String(row.id), nombre: row.nombre, direccion: row.direccion, telefono: row.telefono, activo: row.activo })} type="button">Editar</button><button className="font-semibold text-red-700 hover:underline" onClick={() => remove(row.id)} type="button">Eliminar</button></div> }
        ]} />
      </div>
      <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
        <h2 className="text-xl font-semibold text-ink">{editing ? "Editar sucursal" : "Nueva sucursal"}</h2>
        <div className="mt-5 space-y-4">
          {([["nombre", "Nombre", "text"], ["direccion", "Dirección", "text"], ["telefono", "Teléfono", "tel"]] as const).map(([name, label, type]) => <label className="block text-sm font-medium text-ink" key={name}>{label}<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name={name} onChange={(event) => setForm({ ...form, [name]: event.target.value })} required type={type} value={form[name]} />{name === "telefono" && <span className="mt-1 block text-xs font-normal text-slate-500">Puedes ingresar 8 dígitos; se guardará como +502XXXXXXXX.</span>}</label>)}
          <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={form.activo} name="activo" onChange={(event) => setForm({ ...form, activo: event.target.checked })} type="checkbox" /> Sucursal activa</label>
          {message && <p className="rounded-lg bg-cloud px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
          <div className="flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear sucursal"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" onClick={() => setForm(emptyForm)} type="button">Cancelar</button>}</div>
        </div>
      </form>
    </section>
  );
}
