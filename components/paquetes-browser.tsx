"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { ClienteRow, PaqueteRow, ServicioRow, UsuarioRow } from "@/lib/rpc/types";
import { assignPaquete, createPaquete } from "@/lib/paquetes-actions";

type PackageItem = { servicio_id: number; cantidad: number };

const emptyForm = { nombre: "", precio: "", vigencia_dias: "90" };

  const dateFormatter = new Intl.DateTimeFormat("es-GT", {
  dateStyle: "medium",
  timeZone: "America/Guatemala"
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function PaquetesBrowser({ packages, customers, services, users }: { packages: PaqueteRow[]; customers: ClienteRow[]; services: ServicioRow[]; users: UsuarioRow[] }) {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<PackageItem[]>([]);
  const [serviceToAdd, setServiceToAdd] = useState(String(services[0]?.id ?? ""));
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const serviceNames = new Map(services.map((service) => [service.id, service.nombre]));
  const userNames = new Map(users.map((user) => [user.id, user.nombre]));
  const availableCustomers = customers.filter((customer) => customer.activo);

  function addService() {
    const serviceId = Number(serviceToAdd);
    if (!Number.isInteger(serviceId) || serviceId < 1) return;
    setItems((current) => current.some((item) => item.servicio_id === serviceId)
      ? current
      : [...current, { servicio_id: serviceId, cantidad: 1 }]);
  }

  function changeQuantity(serviceId: number, delta: number) {
    setItems((current) => current.map((item) => item.servicio_id === serviceId
      ? { ...item, cantidad: Math.max(1, Math.min(99, item.cantidad + delta)) }
      : item));
  }

  function removeService(serviceId: number) {
    setItems((current) => current.filter((item) => item.servicio_id !== serviceId));
  }

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const data = new FormData(event.currentTarget);
    data.set("servicios", JSON.stringify(items));
    startTransition(async () => {
      const result = await createPaquete(data);
      if (result.error) return setMessage({ text: result.error, error: true });
      setForm(emptyForm);
      setItems([]);
      setMessage({ text: "Paquete creado.", error: false });
      router.refresh();
    });
  }

  function submitAssign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await assignPaquete(data);
      if (result.error) return setMessage({ text: result.error, error: true });
      form.reset();
      setMessage({ text: `Paquete asignado. Se generaron ${result.coupons ?? 0} cupones de servicio.`, error: false });
      router.refresh();
    });
  }

  return <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div className="space-y-4">
      {packages.map((pkg) => <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel" key={pkg.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-xl font-semibold text-ink">{pkg.nombre}</h2><p className="mt-1 text-sm text-slate-500">Válido por {pkg.vigencia_dias} días · creado por {userNames.get(pkg.creado_por_usuario_id) ?? "Usuario"} · {dateFormatter.format(new Date(pkg.creado_en))}</p></div>
          <p className="text-2xl font-semibold text-jade">Q {Number(pkg.precio).toFixed(2)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{pkg.servicios.map((item) => <span className="rounded-full bg-cloud px-3 py-1.5 text-sm font-medium text-slate-700" key={item.servicio_id}>{item.cantidad} × {item.servicio_nombre}</span>)}</div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-ink">Clientes con este paquete <span className="font-normal text-slate-500">({pkg.asignaciones.length})</span></p>
          {pkg.asignaciones.length > 0 && <div className="mt-2 space-y-1 text-sm text-slate-600">{pkg.asignaciones.slice(0, 5).map((assignment) => <p key={assignment.id}>{assignment.cliente_nombre} · válido hasta {formatDate(assignment.fecha_expiracion)}</p>)}{pkg.asignaciones.length > 5 && <p>…</p>}</div>}
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submitAssign}>
            <input name="paquete_id" type="hidden" value={pkg.id} />
            <label className="sr-only" htmlFor={`cliente-${pkg.id}`}>Cliente para asignar {pkg.nombre}</label>
            <select className="focus-ring min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5" defaultValue="" id={`cliente-${pkg.id}`} name="cliente_id" required>
              <option value="">Selecciona un cliente</option>
              {availableCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nombre} · {customer.telefono}</option>)}
            </select>
            <button className="focus-ring rounded-lg bg-coral px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={pending || availableCustomers.length === 0} type="submit">Asignar</button>
          </form>
        </div>
      </article>)}
      {!packages.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Todavía no hay paquetes creados.</div>}
    </div>
    <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submitCreate}>
      <h2 className="text-xl font-semibold text-ink">Nuevo paquete</h2>
      <p className="mt-1 text-sm text-slate-500">Cada unidad incluida generará un cupón de servicio al asignarlo.</p>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-medium text-ink" htmlFor="paquete-nombre">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" id="paquete-nombre" name="nombre" onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
        <label className="block text-sm font-medium text-ink" htmlFor="paquete-precio">Precio del paquete (GTQ)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" id="paquete-precio" min="0.01" name="precio" onChange={(event) => setForm({ ...form, precio: event.target.value })} required step="0.01" type="number" value={form.precio} /></label>
        <label className="block text-sm font-medium text-ink" htmlFor="paquete-vigencia">Válido por (días)<span className="mt-1 block text-xs font-normal text-slate-500">La cuenta inicia al asignar el paquete al cliente.</span><input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" id="paquete-vigencia" min="1" name="vigencia_dias" onChange={(event) => setForm({ ...form, vigencia_dias: event.target.value })} required type="number" value={form.vigencia_dias} /></label>
        <div>
          <p className="text-sm font-medium text-ink">Servicios incluidos</p>
          <div className="mt-1 flex gap-2"><label className="sr-only" htmlFor="paquete-servicio">Servicio</label><select className="focus-ring min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5" id="paquete-servicio" onChange={(event) => setServiceToAdd(event.target.value)} value={serviceToAdd}><option value="">Selecciona un servicio</option>{services.map((service) => <option key={service.id} value={service.id}>{service.nombre}</option>)}</select><button className="focus-ring inline-flex items-center gap-1 rounded-lg border border-jade px-3 py-2 font-semibold text-jade disabled:opacity-50" disabled={!serviceToAdd || items.some((item) => item.servicio_id === Number(serviceToAdd))} onClick={addService} type="button"><Plus className="h-4 w-4" aria-hidden="true" />Agregar</button></div>
          <div className="mt-3 space-y-2">{items.map((item) => <div className="flex items-center gap-2 rounded-lg bg-cloud px-3 py-2" key={item.servicio_id}><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{serviceNames.get(item.servicio_id) ?? `Servicio #${item.servicio_id}`}</span><button aria-label={`Disminuir cantidad de ${serviceNames.get(item.servicio_id) ?? "servicio"}`} className="focus-ring rounded border border-slate-300 bg-white p-1 text-slate-600 disabled:opacity-40" disabled={item.cantidad <= 1} onClick={() => changeQuantity(item.servicio_id, -1)} type="button"><Minus className="h-4 w-4" aria-hidden="true" /></button><span className="w-6 text-center text-sm font-semibold" aria-label={`Cantidad ${item.cantidad}`}>{item.cantidad}</span><button aria-label={`Aumentar cantidad de ${serviceNames.get(item.servicio_id) ?? "servicio"}`} className="focus-ring rounded border border-slate-300 bg-white p-1 text-slate-600 disabled:opacity-40" disabled={item.cantidad >= 99} onClick={() => changeQuantity(item.servicio_id, 1)} type="button"><Plus className="h-4 w-4" aria-hidden="true" /></button><button aria-label={`Quitar ${serviceNames.get(item.servicio_id) ?? "servicio"}`} className="focus-ring rounded p-1 text-red-700 hover:bg-red-50" onClick={() => removeService(item.servicio_id)} type="button"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>)}{!items.length && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Agrega los servicios que incluirá el paquete.</p>}</div>
        </div>
        <input name="servicios" type="hidden" value={JSON.stringify(items)} />
        {message && <p className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
        <button className="focus-ring w-full rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={pending || items.length === 0} type="submit">{pending ? "Guardando..." : "Crear paquete"}</button>
      </div>
    </form>
  </section>;
}
