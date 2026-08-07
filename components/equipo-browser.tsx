"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PeluqueroRow, SucursalRow, UsuarioRow, UsuarioSucursalRow } from "@/lib/rpc/types";
import { createGroomer, createManager, deleteGroomer, deleteManager, updateGroomer, updateManager } from "@/lib/equipo-actions";
import { DataTable } from "./data-table";

type Props = { managers: UsuarioRow[]; groomers: PeluqueroRow[]; branches: SucursalRow[]; assignments: UsuarioSucursalRow[] };
const emptyGroomer = { id: "", nombre: "", telefono: "", color: "#FFFF00", activo: true };
const emptyManager = { id: "", nombre: "", nombre_usuario: "", telefono: "", alcance: "todas_las_sucursales", activo: true, sucursales: [] as number[] };

export function EquipoBrowser({ managers, groomers, branches, assignments }: Props) {
  const [groomer, setGroomer] = useState(emptyGroomer);
  const [manager, setManager] = useState(emptyManager);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const managerAssignments = (id: string) => assignments.filter((item) => item.usuario_id === id && item.activo).map((item) => item.sucursal_id);

  function submitGroomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = groomer.id ? await updateGroomer(data) : await createGroomer(data);
      setMessage(result.error ?? (groomer.id ? "Groomista actualizado." : "Groomista creado."));
      if (!result.error) { setGroomer(emptyGroomer); router.refresh(); }
    });
  }

  function submitManager(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = manager.id ? await updateManager(data) : await createManager(data);
      setMessage(result.error ?? (manager.id ? "Encargado actualizado." : "Encargado creado."));
      if (!result.error) { setManager(emptyManager); router.refresh(); }
    });
  }

  function remove(kind: "groomer" | "manager", id: number | string) {
    if (!window.confirm("¿Deseas desactivar este registro?")) return;
    const data = new FormData(); data.set("id", String(id));
    startTransition(async () => {
      const result = kind === "groomer" ? await deleteGroomer(data) : await deleteManager(data);
      setMessage(result.error ?? "Registro desactivado.");
      if (!result.error) router.refresh();
    });
  }

  return <div className="mt-6 space-y-6">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5"><h2 className="text-xl font-semibold text-ink">Encargados</h2><p className="mt-1 text-sm text-slate-500">Usuarios que ingresan al sistema y operan las sucursales asignadas.</p></div>
      <DataTable rows={managers} columns={[
        { key: "nombre", header: "Nombre", render: (row) => <span className="font-semibold text-ink">{row.nombre}</span> },
        { key: "rol", header: "Rol", render: (row) => row.rol === "encargado" ? "Encargado" : row.rol },
        { key: "usuario", header: "Usuario", render: (row) => row.nombre_usuario },
        { key: "alcance", header: "Acceso", render: (row) => row.alcance_acceso === "todas_las_sucursales" ? "Todas las sucursales" : "Asignadas" },
        { key: "estado", header: "Estado", render: (row) => <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{row.activo ? "Activo" : "Inactivo"}</span> },
        { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => setManager({ ...emptyManager, id: row.id, nombre: row.nombre, nombre_usuario: row.nombre_usuario, telefono: row.telefono ?? "", alcance: row.alcance_acceso, activo: row.activo, sucursales: managerAssignments(row.id) })} type="button">Editar</button><button className="font-semibold text-red-700 hover:underline" onClick={() => remove("manager", row.id)} type="button">Eliminar</button></div> }
      ]} />
      <form className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-cloud/30 p-4 md:grid-cols-2" onSubmit={submitManager}>
        <h3 className="md:col-span-2 text-lg font-semibold text-ink">{manager.id ? "Editar encargado" : "Nuevo encargado"}</h3>
        {manager.id ? <input name="id" type="hidden" value={manager.id} /> : <label className="text-sm font-medium text-ink md:col-span-2">UUID del usuario en Supabase Auth<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" name="id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required value={manager.id} onChange={(e) => setManager({ ...manager, id: e.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">Crea primero el usuario en Supabase Auth y pega aquí su UUID.</span></label>}
        <label className="text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" name="nombre" onChange={(e) => setManager({ ...manager, nombre: e.target.value })} required value={manager.nombre} /></label>
        <label className="text-sm font-medium text-ink">Usuario<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100" disabled={Boolean(manager.id)} name="nombre_usuario" onChange={(e) => setManager({ ...manager, nombre_usuario: e.target.value })} required={!manager.id} value={manager.nombre_usuario} /></label>
        <label className="text-sm font-medium text-ink">Teléfono<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" name="telefono" onChange={(e) => setManager({ ...manager, telefono: e.target.value })} value={manager.telefono} /></label>
        <label className="text-sm font-medium text-ink">Alcance<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" name="alcance" onChange={(e) => setManager({ ...manager, alcance: e.target.value })} value={manager.alcance}><option value="todas_las_sucursales">Todas las sucursales</option><option value="sucursales_asignadas">Sucursales asignadas</option></select></label>
        {manager.alcance === "sucursales_asignadas" && <fieldset className="text-sm md:col-span-2"><legend className="font-medium text-ink">Sucursales</legend><div className="mt-2 flex flex-wrap gap-3">{branches.map((branch) => <label className="flex items-center gap-2" key={branch.id}><input checked={manager.sucursales.includes(branch.id)} name="sucursal_id" onChange={(e) => setManager({ ...manager, sucursales: e.target.checked ? [...manager.sucursales, branch.id] : manager.sucursales.filter((id) => id !== branch.id) })} type="checkbox" value={branch.id} />{branch.nombre}</label>)}</div></fieldset>}
        <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={manager.activo} name="activo" onChange={(e) => setManager({ ...manager, activo: e.target.checked })} type="checkbox" /> Activo</label>
        <div className="flex items-center gap-3 md:justify-end"><button className="focus-ring rounded-lg bg-jade px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : manager.id ? "Guardar cambios" : "Crear encargado"}</button>{manager.id && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2 font-semibold" onClick={() => setManager(emptyManager)} type="button">Cancelar</button>}</div>
      </form>
    </section>

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5"><h2 className="text-xl font-semibold text-ink">Groomistas</h2><p className="mt-1 text-sm text-slate-500">Personal disponible para asignar a citas de grooming.</p></div>
      <DataTable rows={groomers} columns={[
        { key: "nombre", header: "Nombre", render: (row) => <span className="font-semibold text-ink">{row.nombre}</span> },
        { key: "rol", header: "Rol", render: () => "Groomista" },
        { key: "telefono", header: "Teléfono", render: (row) => row.telefono },
        { key: "color", header: "Color", render: (row) => <span className="inline-block h-5 w-5 rounded-full border border-slate-300" style={{ backgroundColor: row.color_calendario ?? "#FFFF00" }} title={row.color_calendario ?? "#FFFF00"} /> },
        { key: "estado", header: "Estado", render: (row) => <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{row.activo ? "Activo" : "Inactivo"}</span> },
        { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => setGroomer({ id: String(row.id), nombre: row.nombre, telefono: row.telefono ?? "", color: row.color_calendario ?? "#FFFF00", activo: row.activo })} type="button">Editar</button><button className="font-semibold text-red-700 hover:underline" onClick={() => remove("groomer", row.id)} type="button">Eliminar</button></div> }
      ]} />
      <form className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-cloud/30 p-4 md:grid-cols-2" onSubmit={submitGroomer}>
        <h3 className="md:col-span-2 text-lg font-semibold text-ink">{groomer.id ? "Editar groomista" : "Nuevo groomista"}</h3><input name="id" type="hidden" value={groomer.id} />
        <label className="text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" name="nombre" onChange={(e) => setGroomer({ ...groomer, nombre: e.target.value })} required value={groomer.nombre} /></label>
        <label className="text-sm font-medium text-ink">Teléfono (opcional)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" name="telefono" onChange={(e) => setGroomer({ ...groomer, telefono: e.target.value })} value={groomer.telefono} /><span className="mt-1 block text-xs font-normal text-slate-500">Puedes ingresar 8 dígitos; se guardará como +502XXXXXXXX.</span></label>
        <label className="text-sm font-medium text-ink">Color de calendario<input className="focus-ring mt-1 block h-10 w-16 rounded border border-slate-300 p-1" name="color" onChange={(e) => setGroomer({ ...groomer, color: e.target.value })} type="color" value={groomer.color} /></label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={groomer.activo} name="activo" onChange={(e) => setGroomer({ ...groomer, activo: e.target.checked })} type="checkbox" /> Activo</label>
        <div className="flex items-center gap-3 md:justify-end"><button className="focus-ring rounded-lg bg-jade px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : groomer.id ? "Guardar cambios" : "Crear groomista"}</button>{groomer.id && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2 font-semibold" onClick={() => setGroomer(emptyGroomer)} type="button">Cancelar</button>}</div>
      </form>
    </section>
    {message && <p className="rounded-lg bg-cloud px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
  </div>;
}
