"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, PenLine, Search, UserRound } from "lucide-react";
import { formatGuatemalaDateTime } from "@/lib/business-rules";
import { sizeLabels, speciesLabels } from "@/lib/labels";
import { createMascota, deleteMascota, getMascotaHistory, updateMascota } from "@/lib/mascotas-actions";
import { searchClientes } from "@/lib/clientes-actions";
import type { Customer, MascotaHistoryItem, MascotasPageData, Pet } from "@/lib/types";

const emptyForm = { id: "", cliente_id: "", nombre: "", especie: "perro", raza: "", tamano_id: "", fecha_nacimiento: "", notas_salud: "", notas_comportamiento: "", intervalo_preferido_dias: "", cliente_nombre: "", cliente_telefono: "", cliente_email: "", cliente_notas: "", cliente_whatsapp_opt_in: false, cliente_sms_opt_in: false };

export function MascotasBrowser({ data, page, initialQuery }: { data: MascotasPageData; page: number; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [form, setForm] = useState(emptyForm);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newClient, setNewClient] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [histories, setHistories] = useState<Record<number, MascotaHistoryItem[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);
  const [customerOptions, setCustomerOptions] = useState<Array<Pick<Customer, "id" | "name" | "phone">>>(data.customers);
  const [isPending, startTransition] = useTransition();
  const [isSearchingCustomers, startCustomerSearch] = useTransition();
  const router = useRouter();
  const editing = Boolean(form.id);

  useEffect(() => {
    if (query === initialQuery) return;
    const timeout = window.setTimeout(() => router.replace(`/mascotas?page=1${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`), 300);
    return () => window.clearTimeout(timeout);
  }, [initialQuery, query, router]);

  useEffect(() => {
    const value = customerSearch.trim();
    if (newClient || value.length < 2 || value.includes(" · ")) return;
    const timeout = window.setTimeout(() => startCustomerSearch(async () => {
      const result = await searchClientes(value);
      if (result.customers) setCustomerOptions(result.customers);
    }), 300);
    return () => window.clearTimeout(timeout);
  }, [customerSearch, data.customers, newClient]);

  const normalizedQuery = query.trim().toLowerCase();

  const pets = data.pets
    .map((pet) => {
      const customer = data.customers.find((item) => item.id === pet.customerId);
      return { pet, customer, history: histories[pet.id] };
    })
    .filter(({ pet, customer }) => {
      if (!normalizedQuery) return true;

      return (
        pet.name.toLowerCase().includes(normalizedQuery) ||
        pet.breed.toLowerCase().includes(normalizedQuery) ||
        speciesLabels[pet.species].toLowerCase().includes(normalizedQuery) ||
        customer?.name.toLowerCase().includes(normalizedQuery) ||
        customer?.phone.toLowerCase().includes(normalizedQuery)
      );
    });

  async function loadHistory(petId: number) {
    setHistoryLoadingId(petId);
    const result = await getMascotaHistory(petId);
    setHistoryLoadingId(null);
    if (result.error) return setMessage({ text: result.error, error: true });
    setHistories((current) => ({ ...current, [petId]: result.history ?? [] }));
  }

  function update(field: string, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function edit(pet: Pet) {
    const customer = data.customers.find((item) => item.id === pet.customerId);
    const size = (data.sizes ?? []).find((item) => item.species === pet.species && item.name.toLowerCase() === sizeLabels[pet.size].toLowerCase());
    setForm({ ...emptyForm, id: String(pet.id), cliente_id: String(pet.customerId), nombre: pet.name, especie: pet.species, raza: pet.breed, tamano_id: String(size?.id ?? ""), fecha_nacimiento: pet.birthdate?.slice(0, 10) ?? "", notas_salud: pet.healthNotes, notas_comportamiento: pet.behaviorNotes, cliente_nombre: customer?.name ?? "" });
    setCustomerSearch(customer ? `${customer.name} · ${customer.phone}` : "");
    if (customer) setCustomerOptions((current) => current.some((item) => item.id === customer.id) ? current : [...current, customer]);
    setNewClient(false);
    setMessage(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!newClient) {
      const selected = customerOptions.find((customer) => `${customer.name} · ${customer.phone}` === formData.get("cliente_busqueda"));
      if (!selected) return setMessage({ text: "Selecciona un cliente existente o crea uno nuevo.", error: true });
      formData.set("cliente_id", String(selected.id));
    }
    startTransition(async () => {
      const result = editing ? await updateMascota(formData) : await createMascota(formData);
      if (result.error) return setMessage({ text: result.error, error: true });
      setForm(emptyForm);
      setCustomerSearch("");
      setNewClient(false);
      setMessage({ text: editing ? "Mascota actualizada." : "Mascota creada.", error: false });
      router.refresh();
    });
  }

  function remove(id: number) {
    if (!window.confirm("¿Deseas desactivar esta mascota?")) return;
    const formData = new FormData();
    formData.set("id", String(id));
    startTransition(async () => {
      const result = await deleteMascota(formData);
      setMessage({ text: result.error ?? "Mascota desactivada.", error: Boolean(result.error) });
      if (!result.error) router.refresh();
    });
  }

  return (
    <>
      <form className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel" onSubmit={submit}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-semibold text-ink">{editing ? "Editar mascota" : "Nueva mascota"}</h2><p className="mt-1 text-sm text-slate-500">La mascota se guarda activa y debe quedar vinculada a un cliente.</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="nombre" required value={form.nombre} onChange={(event) => update("nombre", event.target.value)} /></label>
          <label className="block text-sm font-medium text-ink">Cliente existente<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" name="cliente_busqueda" list="clientes" disabled={newClient} value={newClient ? "" : customerSearch} onChange={(event) => { const value = event.target.value; setCustomerSearch(value); if (value.trim().length < 2) setCustomerOptions(data.customers); }} /></label>
          <datalist id="clientes">{customerOptions.map((customer) => <option key={customer.id} value={`${customer.name} · ${customer.phone}`} />)}</datalist>
          {isSearchingCustomers && <p className="text-xs text-slate-500" role="status">Buscando clientes...</p>}
          <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" disabled={editing} checked={newClient} onChange={(event) => { setNewClient(event.target.checked); update("cliente_nombre", ""); }} /> Crear cliente nuevo</label>
          <label className="block text-sm font-medium text-ink">Especie<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="especie" value={form.especie} onChange={(event) => setForm((current) => ({ ...current, especie: event.target.value, tamano_id: "" }))}><option value="perro">Perro</option><option value="gato">Gato</option><option value="otro">Otro</option></select></label>
          <label className="block text-sm font-medium text-ink">Raza<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="raza" value={form.raza} onChange={(event) => update("raza", event.target.value)} /></label>
          <label className="block text-sm font-medium text-ink">{form.especie === "gato" ? "Tipo de pelo" : "Tamaño"}<select className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="tamano_id" required value={form.tamano_id} onChange={(event) => update("tamano_id", event.target.value)}><option value="">Seleccionar</option>{(data.sizes ?? []).filter((size) => size.species === form.especie).map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}</select></label>
          <label className="block text-sm font-medium text-ink">Fecha de nacimiento<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="fecha_nacimiento" type="date" value={form.fecha_nacimiento} onChange={(event) => update("fecha_nacimiento", event.target.value)} /></label>
          <label className="block text-sm font-medium text-ink">Intervalo preferido (días)<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="intervalo_preferido_dias" type="number" min="1" value={form.intervalo_preferido_dias} onChange={(event) => update("intervalo_preferido_dias", event.target.value)} /></label>
          <label className="block text-sm font-medium text-ink md:col-span-2">Notas de salud<textarea className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="notas_salud" rows={2} value={form.notas_salud} onChange={(event) => update("notas_salud", event.target.value)} /></label>
          <label className="block text-sm font-medium text-ink md:col-span-2">Notas de comportamiento<textarea className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="notas_comportamiento" rows={2} value={form.notas_comportamiento} onChange={(event) => update("notas_comportamiento", event.target.value)} /></label>
        </div>
        {newClient && <div className="mt-4 rounded-lg bg-cloud p-4"><p className="font-semibold text-ink">Nuevo cliente</p><div className="mt-3 grid gap-4 md:grid-cols-2"><label className="block text-sm font-medium text-ink">Nombre<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="cliente_nombre" required value={form.cliente_nombre} onChange={(event) => update("cliente_nombre", event.target.value)} /></label><label className="block text-sm font-medium text-ink">Teléfono<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="cliente_telefono" required type="tel" value={form.cliente_telefono} onChange={(event) => update("cliente_telefono", event.target.value)} /></label><label className="block text-sm font-medium text-ink md:col-span-2">Correo electrónico<input className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="cliente_email" type="email" value={form.cliente_email} onChange={(event) => update("cliente_email", event.target.value)} /></label><div className="flex gap-4 text-sm md:col-span-2"><label><input name="cliente_whatsapp_opt_in" type="checkbox" checked={form.cliente_whatsapp_opt_in} onChange={(event) => update("cliente_whatsapp_opt_in", event.target.checked)} /> Acepta WhatsApp</label><label><input name="cliente_sms_opt_in" type="checkbox" checked={form.cliente_sms_opt_in} onChange={(event) => update("cliente_sms_opt_in", event.target.checked)} /> Acepta SMS</label></div><label className="block text-sm font-medium text-ink md:col-span-2">Notas<textarea className="focus-ring mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" name="cliente_notas" rows={2} value={form.cliente_notas} onChange={(event) => update("cliente_notas", event.target.value)} /></label></div></div>}
        <input type="hidden" name="id" value={form.id} /><input type="hidden" name="cliente_id" value={form.cliente_id} />
        {message && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
        <div className="mt-4 flex gap-3"><button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : editing ? "Guardar cambios" : "Crear mascota"}</button>{editing && <button className="focus-ring rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700" type="button" onClick={() => { setForm(emptyForm); setCustomerSearch(""); setNewClient(false); }}>Cancelar</button>}</div>
      </form>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Directorio de mascotas</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pets.length} mascota{pets.length === 1 ? "" : "s"} encontrada{pets.length === 1 ? "" : "s"}.
              </p>
            </div>
            <label className="focus-ring flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm lg:w-[28rem]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en esta página"
              />
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {pets.map(({ pet, customer, history }) => {
              return (
                <article
                  key={pet.id}
                  className="rounded-lg border border-slate-200 bg-cloud/30 p-4 transition hover:border-jade/40 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      {pet.profilePhotoUrl ? (
                        <Image
                          src={pet.profilePhotoUrl}
                          alt={`Foto de ${pet.name}`}
                          width={64}
                          height={64}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white text-jade">
                          <UserRound className="h-7 w-7" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-ink">{pet.name}</h3>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-jade">
                            {history ? `${history.length} cita${history.length === 1 ? "" : "s"}` : "Historial pendiente"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {speciesLabels[pet.species]} · {pet.breed} · {sizeLabels[pet.size]}
                        </p>
                        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                          <UserRound className="h-4 w-4 shrink-0 text-jade" aria-hidden="true" />
                          {customer?.name} · {customer?.phone}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 lg:text-right">
                      <p className="font-semibold text-ink">Historial de servicios</p>
                      {!history && <button type="button" disabled={historyLoadingId === pet.id} onClick={() => void loadHistory(pet.id)} className="focus-ring rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700">{historyLoadingId === pet.id ? "Cargando historial..." : "Cargar historial"}</button>}
                      {history?.slice(0, 2).map((appointment) => <p key={appointment.id}>{appointment.scheduledStart.slice(0, 10)} · {appointment.status}</p>)}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm"><button className="font-semibold text-jade hover:underline" type="button" onClick={() => edit(pet)}>Editar</button><button className="font-semibold text-red-700 hover:underline" type="button" onClick={() => remove(pet.id)}>Eliminar</button></div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-ink">Salud</p>
                      <p className="mt-1">{pet.healthNotes}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 text-sm text-slate-700">
                      <p className="font-semibold text-ink">Comportamiento</p>
                      <p className="mt-1">{pet.behaviorNotes}</p>
                    </div>
                  </div>
                  {history && <div className="mt-4 rounded-lg bg-white p-3"><p className="font-semibold text-ink">Historial de servicios</p><div className="mt-3 space-y-3">{history.map((appointment) => <div key={appointment.id} className="rounded-lg border border-slate-200 bg-cloud/40 p-3"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-semibold text-ink">{formatGuatemalaDateTime(appointment.scheduledStart)}</p><p className="mt-1 text-sm text-slate-600">{appointment.serviceName} · {appointment.groomerName}</p><p className="mt-1 text-xs text-slate-500">{appointment.branchName}</p></div><div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-2.5 py-1 text-slate-700">{appointment.status}</span><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${appointment.hasSignature ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{appointment.hasSignature ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <PenLine className="h-3.5 w-3.5" aria-hidden="true" />}{appointment.hasSignature ? "Firmado" : "Firma pendiente"}</span><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700"><Camera className="h-3.5 w-3.5" aria-hidden="true" />{appointment.hasPhotos ? "Fotos" : "Sin fotos"}</span></div></div><div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2"><p className="rounded-lg bg-white p-2"><span className="block text-xs font-semibold uppercase text-slate-500">Indicaciones</span>{appointment.notes || "Sin indicaciones"}</p><p className="rounded-lg bg-white p-2"><span className="block text-xs font-semibold uppercase text-slate-500">Resultado</span>{appointment.outcome}</p></div></div>)}</div></div>}
                </article>
              );
            })}
            {pets.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-cloud px-4 py-10 text-center text-sm text-slate-500">
                No encontramos mascotas con ese filtro.
              </div>
            )}
          </div>
        {Math.ceil(data.total / data.pageSize) > 1 && <div className="mt-5 flex items-center justify-between"><button className="focus-ring rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => router.push(`/mascotas?page=${page - 1}${initialQuery ? `&q=${encodeURIComponent(initialQuery)}` : ""}`)}>Anterior</button><span className="text-sm text-slate-500">Página {page} de {Math.ceil(data.total / data.pageSize)}</span><button className="focus-ring rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" type="button" disabled={page >= Math.ceil(data.total / data.pageSize)} onClick={() => router.push(`/mascotas?page=${page + 1}${initialQuery ? `&q=${encodeURIComponent(initialQuery)}` : ""}`)}>Siguiente</button></div>}
    </section>
    </>
  );
}
