"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, CheckCircle2, Wand2 } from "lucide-react";
import { buildReminderMessage, hasGroomerConflict } from "@/lib/business-rules";
import type { AppData, Appointment } from "@/lib/types";
import { createCita, deleteCita, updateCita } from "@/lib/citas-actions";
import { SearchableSelect } from "./searchable-select";

export function ScheduleForm({
  data,
  initialDate = "2026-06-23",
  initialTime = "15:00",
  appointment,
  onClose
}: {
  data: AppData;
  initialDate?: string;
  initialTime?: string;
  appointment?: Appointment;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(appointment?.branchId ?? data.branches[0]?.id ?? 0);
  const [petId, setPetId] = useState(appointment?.petId ?? 0);
  const [groomerId, setGroomerId] = useState(appointment?.groomerId ?? data.users.find((user) => user.role === "groomer")?.id ?? 0);
  const [serviceId, setServiceId] = useState(appointment?.serviceIds[0] ?? data.services[0]?.id ?? 0);
  const [date, setDate] = useState(appointment ? appointment.scheduledStart.slice(0, 10) : initialDate);
  const [time, setTime] = useState(appointment ? new Date(appointment.scheduledStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala" }) : initialTime);
  const [source, setSource] = useState(appointment?.source === "phone" ? "telefono" : appointment?.source === "whatsapp" ? "whatsapp" : "presencial");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const selectedService = data.services.find((service) => service.id === serviceId) ?? data.services[0];
  const selectedPet = data.pets.find((pet) => pet.id === petId) ?? data.pets[0];
  const selectedCustomer = data.customers.find((customer) => customer.id === selectedPet?.customerId) ?? data.customers[0];
  const selectedBranch = data.branches.find((branch) => branch.id === branchId) ?? data.branches[0];
  const groomers = data.users.filter((user) => user.role === "groomer" && user.branchIds.includes(branchId));
  const petOptions = data.pets.map((pet) => {
    const customer = data.customers.find((item) => item.id === pet.customerId);
    return { value: pet.id, label: `${pet.name} · ${customer?.name ?? "Sin cliente"} · ${customer?.phone ?? ""}` };
  });

  const startIso = `${date}T${time}:00-06:00`;
  const [hours, minutes] = time.split(":").map(Number);
  const endTotalMinutes = hours * 60 + minutes + (selectedService?.estimatedDurationMinutes ?? 30);
  const endHours = String(Math.floor(endTotalMinutes / 60) % 24).padStart(2, "0");
  const endMinutes = String(endTotalMinutes % 60).padStart(2, "0");
  const endIso = `${date}T${endHours}:${endMinutes}:00-06:00`;

  const hasConflict = hasGroomerConflict(data.appointments, {
    id: appointment?.id,
    groomerId,
    scheduledStart: startIso,
    scheduledEnd: endIso
  });

  const reminder = useMemo(
    () =>
      buildReminderMessage({
        customerName: selectedCustomer?.name.split(" ")[0] ?? "cliente",
        petName: selectedPet?.name ?? "mascota",
        branchName: selectedBranch?.name ?? "sucursal",
        appointmentStart: startIso,
        serviceNames: selectedService ? [selectedService.name] : []
      }),
    [selectedBranch?.name, selectedCustomer?.name, selectedPet?.name, selectedService, startIso]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const result = appointment ? await updateCita(formData) : await createCita(formData);
    setIsPending(false);
    if (result.error) return setMessage(result.error);
    router.refresh();
    onClose?.();
  }

  async function remove() {
    if (!appointment || !window.confirm("¿Deseas desactivar esta cita?")) return;
    const formData = new FormData();
    formData.set("id", String(appointment.id));
    setIsPending(true);
    const result = await deleteCita(formData);
    setIsPending(false);
    if (result.error) return setMessage(result.error);
    router.refresh();
    onClose?.();
  }

  return (
    <form id="agenda" className="rounded-lg bg-white" onSubmit={submit}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">{appointment ? "Editar cita" : "Nueva cita"}</h2>
          <p className="text-sm text-slate-500">Entrada manual para WhatsApp, telefono o mostrador.</p>
        </div>
        <CalendarPlus className="h-5 w-5 text-jade" aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Sucursal
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={branchId} onChange={(event) => {
            const nextBranchId = Number(event.target.value);
            setBranchId(nextBranchId);
            setGroomerId(data.users.find((user) => user.role === "groomer" && user.branchIds.includes(nextBranchId))?.id ?? 0);
          }}>
            {data.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Mascota
          <SearchableSelect options={petOptions} value={petId || null} onChange={(value) => setPetId(value ?? 0)} placeholder="Buscar mascota, dueño o teléfono" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Groomer
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={groomerId} onChange={(event) => setGroomerId(Number(event.target.value))}>
            {groomers.map((groomer) => (
              <option key={groomer.id} value={groomer.id}>{groomer.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Servicio
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={serviceId} onChange={(event) => setServiceId(Number(event.target.value))}>
            {data.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.estimatedDurationMinutes} min
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Fecha
          <input className="focus-ring rounded-lg border border-slate-300 px-3 py-2" name="fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Hora
          <input className="focus-ring rounded-lg border border-slate-300 px-3 py-2" name="hora" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
          Origen
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" name="origen" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="presencial">Mostrador</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telefono">Telefono</option>
          </select>
        </label>
      </div>

      <div className={`mt-5 rounded-lg border p-3 text-sm ${hasConflict ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
        <div className="flex items-center gap-2 font-semibold">
          {hasConflict ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {hasConflict ? "Conflicto de agenda detectado" : "Horario disponible para este groomer"}
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-ink p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-maize" aria-hidden="true" />
          Mensaje WhatsApp sugerido
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-100">{reminder}</p>
      </div>
      <input name="id" type="hidden" value={appointment?.id ?? ""} readOnly />
      <input name="sucursal_id" type="hidden" value={branchId} readOnly />
      <input name="mascota_id" type="hidden" value={petId} readOnly />
      <input name="peluquero_id" type="hidden" value={groomerId} readOnly />
      <input name="servicio_id" type="hidden" value={serviceId} readOnly />
      <input name="estado" type="hidden" value={appointment?.status === "cancelled" ? "cancelada" : appointment?.status === "no_show" ? "no_asistio" : ["completed", "in_progress", "checked_in"].includes(appointment?.status ?? "") ? "atendida" : "programada"} readOnly />
      <input name="fin_programado" type="hidden" value={endIso} readOnly />
      <div className="mt-5 flex gap-3">
        <button className="focus-ring rounded-lg bg-jade px-4 py-2.5 font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando..." : appointment ? "Guardar cambios" : "Crear cita"}</button>
        {appointment && <button className="focus-ring rounded-lg border border-red-200 px-4 py-2.5 font-semibold text-red-700" disabled={isPending} type="button" onClick={remove}>Desactivar</button>}
      </div>
      {message && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{message}</p>}
    </form>
  );
}
