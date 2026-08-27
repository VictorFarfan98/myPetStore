"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClienteRow, CuponRow, ServicioRow, UsuarioRow } from "@/lib/rpc/types";
import { createCupon, deleteCupon, updateCupon } from "@/lib/cupones-actions";
import { DataTable } from "./data-table";

type FormState = {
  id: string;
  nombre: string;
  cliente_id: string;
  servicio_id: string;
  tipo_descuento: string;
  valor: string;
  fecha_expiracion: string;
  uso_unico: boolean;
  activo: boolean;
  origen: "manual" | "automatico";
};

const emptyForm: FormState = { id: "", nombre: "", cliente_id: "", servicio_id: "", tipo_descuento: "porcentaje", valor: "", fecha_expiracion: "", uso_unico: true, activo: true, origen: "manual" };

export function CuponesBrowser({ coupons, customers, services, users }: { coupons: CuponRow[]; customers: ClienteRow[]; services: ServicioRow[]; users: UsuarioRow[] }) {
  const [customerFilter, setCustomerFilter] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(form.id);
  const automatic = form.origen === "automatico";
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.nombre]));
  const serviceNames = new Map(services.map((service) => [service.id, service.nombre]));
  const userNames = new Map(users.map((user) => [user.id, user.nombre]));
  const rows = coupons.filter((coupon) => !customerFilter || coupon.cliente_id === Number(customerFilter) || coupon.cliente_id === null);

  function reset() {
    setForm(emptyForm);
  }

  function edit(coupon: CuponRow) {
    setForm({ id: coupon.id, nombre: coupon.nombre, cliente_id: String(coupon.cliente_id ?? ""), servicio_id: String(coupon.servicio_id ?? ""), tipo_descuento: coupon.tipo_descuento, valor: coupon.valor, fecha_expiracion: coupon.fecha_expiracion ? String(coupon.fecha_expiracion).slice(0, 10) : "", uso_unico: coupon.uso_unico, activo: coupon.activo, origen: coupon.origen });
    setMessage(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = editing ? await updateCupon(data) : await createCupon(data);
      if (result.error) return setMessage({ text: result.error, error: true });
      setMessage({ text: editing ? "Cupón actualizado." : "Cupón creado.", error: false });
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("¿Deseas desactivar este cupón?")) return;
    const data = new FormData();
    data.set("id", id);
    startTransition(async () => {
      const result = await deleteCupon(data);
      setMessage({ text: result.error ?? "Cupón desactivado.", error: Boolean(result.error) });
      if (!result.error) router.refresh();
    });
  }

  return <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold text-ink">Cupones creados</h2><p className="mt-1 text-sm text-slate-500">{rows.length} cupón{rows.length === 1 ? "" : "es"} visible{rows.length === 1 ? "" : "s"}.</p></div><label className="text-sm font-medium text-ink">Filtrar por cliente<select className="focus-ring mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">Todos los clientes</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nombre}</option>)}</select></label></div>
      <DataTable rows={rows} columns={[
        { key: "nombre", header: "Cupón", render: (row) => <div><p className="font-semibold text-ink">{row.nombre}</p><p className="text-xs text-slate-500">{row.origen === "automatico" ? "Automático" : "Manual"} · {row.uso_unico ? "Uso único" : "Reutilizable"}</p></div> },
        { key: "cliente", header: "Cliente", render: (row) => row.cliente_id ? customerNames.get(row.cliente_id) ?? "Cliente desconocido" : "Todos" },
        { key: "servicio", header: "Servicio", render: (row) => row.servicio_id ? serviceNames.get(row.servicio_id) ?? "Servicio desconocido" : "Todos" },
        { key: "descuento", header: "Descuento", render: (row) => row.tipo_descuento === "porcentaje" ? `${Number(row.valor)}%` : `Q ${Number(row.valor).toFixed(2)}` },
        { key: "vigencia", header: "Vigencia", render: (row) => row.fecha_expiracion ? new Date(`${String(row.fecha_expiracion).slice(0, 10)}T12:00:00`).toLocaleDateString("es-GT") : "Indefinida" },
        { key: "creador", header: "Creado por", render: (row) => row.creado_por_usuario_id ? userNames.get(row.creado_por_usuario_id) ?? "Usuario" : "Sistema" },
        { key: "estado", header: "Estado", render: (row) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{row.activo ? "Activo" : row.canjeado_en ? "Canjeado" : "Inactivo"}</span> },
        { key: "acciones", header: "Acciones", render: (row) => row.canjeado_en ? "—" : <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" onClick={() => edit(row)} type="button">Editar</button>{row.activo && <button className="font-semibold text-red-700 hover:underline" onClick={() => remove(row.id)} type="button">Desactivar</button>}</div> }
      ]} />
    </div>
    <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
      <h2 className="text-xl font-semibold text-ink">{editing ? "Editar cupón" : "Nuevo cupón"}</h2>
      {automatic && <p className="mt-2 text-sm text-slate-500">Las reglas de una recompensa automática no se pueden cambiar; únicamente puede desactivarse.</p>}
      <div className="mt-5 space-y-4">
        <input name="id" type="hidden" value={form.id} />
        <label className="block text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={automatic} name="nombre" onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
        <label className="block text-sm font-medium text-ink">Cliente<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={automatic} name="cliente_id" onChange={(event) => setForm({ ...form, cliente_id: event.target.value })} value={form.cliente_id}><option value="">Todos los clientes</option>{customers.filter((customer) => customer.activo || customer.id === Number(form.cliente_id)).map((customer) => <option key={customer.id} value={customer.id}>{customer.nombre}</option>)}</select></label>
        <label className="block text-sm font-medium text-ink">Servicio<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={automatic} name="servicio_id" onChange={(event) => setForm({ ...form, servicio_id: event.target.value })} value={form.servicio_id}><option value="">Todos los servicios</option>{services.filter((service) => service.activo || service.id === Number(form.servicio_id)).map((service) => <option key={service.id} value={service.id}>{service.nombre}</option>)}</select></label>
        <label className="block text-sm font-medium text-ink">Tipo de descuento<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={automatic} name="tipo_descuento" onChange={(event) => setForm({ ...form, tipo_descuento: event.target.value })} value={form.tipo_descuento}><option value="porcentaje">Porcentaje</option><option value="monto_fijo">Monto fijo</option></select></label>
        <label className="block text-sm font-medium text-ink">Valor<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={automatic} max={form.tipo_descuento === "porcentaje" ? 100 : undefined} min="0.01" name="valor" onChange={(event) => setForm({ ...form, valor: event.target.value })} required step="0.01" type="number" value={form.valor} /></label>
        <label className="block text-sm font-medium text-ink">Fecha de expiración<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" disabled={automatic} name="fecha_expiracion" onChange={(event) => setForm({ ...form, fecha_expiracion: event.target.value })} type="date" value={form.fecha_expiracion} /><span className="mt-1 block text-xs font-normal text-slate-500">Déjala vacía para vigencia indefinida.</span></label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={form.uso_unico} disabled={automatic} name="uso_unico" onChange={(event) => setForm({ ...form, uso_unico: event.target.checked })} type="checkbox" /> Cupón de uso único</label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink"><input checked={form.activo} name="activo" onChange={(event) => setForm({ ...form, activo: event.target.checked })} type="checkbox" /> Cupón activo</label>
        {automatic && <><input name="nombre" type="hidden" value={form.nombre} /><input name="cliente_id" type="hidden" value={form.cliente_id} /><input name="servicio_id" type="hidden" value={form.servicio_id} /><input name="tipo_descuento" type="hidden" value={form.tipo_descuento} /><input name="valor" type="hidden" value={form.valor} /><input name="fecha_expiracion" type="hidden" value={form.fecha_expiracion} /><input name="uso_unico" type="hidden" value="on" /></>}
        {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
        <div className="flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Guardando..." : editing ? "Guardar cambios" : "Crear cupón"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" onClick={reset} type="button">Cancelar</button>}</div>
      </div>
    </form>
  </section>;
}
