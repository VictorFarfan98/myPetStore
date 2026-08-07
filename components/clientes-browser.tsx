"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import type { ClientesData, Customer } from "@/lib/types";
import { createCliente, deleteCliente, updateCliente } from "@/lib/clientes-actions";
import { DataTable } from "./data-table";

const emptyForm = { id: "", nombre: "", telefono: "", whatsapp_opt_in: false, sms_opt_in: false, notas: "", activo: true };

export function ClientesBrowser({ data }: { data: ClientesData }) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(form.id);
  const normalizedQuery = query.trim().toLowerCase();

  console.log("Clientes", data);
  const rows = data.customers
    .map((customer) => ({ customer, pets: data.pets.filter((pet) => pet.customerId === customer.id) }))
    .filter(({ customer, pets }) => !normalizedQuery || [customer.name, customer.phone, customer.notes, ...pets.flatMap((pet) => [pet.name, pet.breed])].some((value) => value.toLowerCase().includes(normalizedQuery)));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = editing ? await updateCliente(formData) : await createCliente(formData);
      if (result.error) return setMessage(result.error);
      setForm(emptyForm);
      setMessage(editing ? "Cliente actualizado." : "Cliente creado.");
      router.refresh();
    });
  }

  function edit(customer: Customer) {
    setForm({ id: String(customer.id), nombre: customer.name, telefono: customer.phone, whatsapp_opt_in: customer.whatsappOptIn, sms_opt_in: Boolean(customer.smsOptIn), notas: customer.notes, activo: true });
    setMessage("");
  }

  function remove(id: number) {
    if (!window.confirm("¿Deseas desactivar este cliente?")) return;
    const formData = new FormData();
    formData.set("id", String(id));
    startTransition(async () => {
      const result = await deleteCliente(formData);
      setMessage(result.error ?? "Cliente desactivado.");
      if (!result.error) router.refresh();
    });
  }

  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="text-xl font-semibold text-ink">Directorio de clientes</h2><p className="mt-1 text-sm text-slate-500">{rows.length} cliente{rows.length === 1 ? "" : "s"} encontrado{rows.length === 1 ? "" : "s"}.</p></div>
          <label className="focus-ring flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"><Search className="h-4 w-4 text-slate-400" aria-hidden="true" /><input className="w-full bg-transparent outline-none" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente o mascota" /></label>
        </div>
        <div className="mt-5"><DataTable rows={rows.map(({ customer, pets }) => ({ ...customer, pets }))} columns={[
          { key: "nombre", header: "Cliente", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
          { key: "contacto", header: "Contacto", render: (row) => <span>{row.phone}{row.smsOptIn ? " · SMS" : ""}</span> },
          { key: "mascotas", header: "Mascotas", render: (row) => row.pets.map((pet) => pet.name).join(", ") || "—" },
          { key: "acciones", header: "Acciones", render: (row) => <div className="flex gap-3"><button className="font-semibold text-jade hover:underline" type="button" onClick={() => edit(row)}>Editar</button><button className="font-semibold text-red-700 hover:underline" type="button" onClick={() => remove(row.id)}>Eliminar</button></div> }
        ]} /></div>
      </div>
      <form className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
        <h2 className="text-xl font-semibold text-ink">{editing ? "Editar cliente" : "Nuevo cliente"}</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="nombre" required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
          <label className="block text-sm font-medium text-ink">Teléfono<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="telefono" required type="tel" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">8 dígitos o formato E.164.</span></label>
          <div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input name="whatsapp_opt_in" type="checkbox" checked={form.whatsapp_opt_in} onChange={(event) => setForm({ ...form, whatsapp_opt_in: event.target.checked })} /> Acepta WhatsApp</label><label className="flex items-center gap-2"><input name="sms_opt_in" type="checkbox" checked={form.sms_opt_in} onChange={(event) => setForm({ ...form, sms_opt_in: event.target.checked })} /> Acepta SMS</label></div>
          <label className="block text-sm font-medium text-ink">Notas<textarea className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="notas" rows={3} value={form.notas} onChange={(event) => setForm({ ...form, notas: event.target.value })} /></label>
          {message && <p className="rounded-lg bg-cloud px-3 py-2 text-sm text-slate-700" role="status">{message}</p>}
          <div className="flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear cliente"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" type="button" onClick={() => setForm(emptyForm)}>Cancelar</button>}</div>
        </div>
      </form>
    </section>
  );
}
