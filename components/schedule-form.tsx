"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, CheckCircle2, Wand2 } from "lucide-react";
import { buildReminderMessage, hasGroomerConflict } from "@/lib/business-rules";
import type { AppData } from "@/lib/types";

export function ScheduleForm({
  data,
  initialDate = "2026-06-23",
  initialTime = "15:00"
}: {
  data: AppData;
  initialDate?: string;
  initialTime?: string;
}) {
  const [branchId, setBranchId] = useState(data.branches[0].id);
  const [petId, setPetId] = useState(data.pets[0].id);
  const [groomerId, setGroomerId] = useState(3);
  const [serviceId, setServiceId] = useState(2);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [source, setSource] = useState("whatsapp");

  const selectedService = data.services.find((service) => service.id === serviceId)!;
  const selectedPet = data.pets.find((pet) => pet.id === petId)!;
  const selectedCustomer = data.customers.find((customer) => customer.id === selectedPet.customerId)!;
  const selectedBranch = data.branches.find((branch) => branch.id === branchId)!;
  const groomers = data.users.filter((user) => user.role === "groomer" && user.branchIds.includes(branchId));

  const startIso = `${date}T${time}:00-06:00`;
  const [hours, minutes] = time.split(":").map(Number);
  const endTotalMinutes = hours * 60 + minutes + selectedService.estimatedDurationMinutes;
  const endHours = String(Math.floor(endTotalMinutes / 60) % 24).padStart(2, "0");
  const endMinutes = String(endTotalMinutes % 60).padStart(2, "0");
  const endIso = `${date}T${endHours}:${endMinutes}:00-06:00`;

  const hasConflict = hasGroomerConflict(data.appointments, {
    groomerId,
    scheduledStart: startIso,
    scheduledEnd: endIso
  });

  const reminder = useMemo(
    () =>
      buildReminderMessage({
        customerName: selectedCustomer.name.split(" ")[0],
        petName: selectedPet.name,
        branchName: selectedBranch.name,
        appointmentStart: startIso,
        serviceNames: [selectedService.name]
      }),
    [selectedBranch.name, selectedCustomer.name, selectedPet.name, selectedService.name, startIso]
  );

  return (
    <section id="agenda" className="rounded-lg bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Nueva cita</h2>
          <p className="text-sm text-slate-500">Entrada manual para WhatsApp, telefono o mostrador.</p>
        </div>
        <CalendarPlus className="h-5 w-5 text-jade" aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Sucursal
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={branchId} onChange={(event) => setBranchId(Number(event.target.value))}>
            {data.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Mascota
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={petId} onChange={(event) => setPetId(Number(event.target.value))}>
            {data.pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
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
          <input className="focus-ring rounded-lg border border-slate-300 px-3 py-2" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Hora
          <input className="focus-ring rounded-lg border border-slate-300 px-3 py-2" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
          Origen
          <select className="focus-ring rounded-lg border border-slate-300 px-3 py-2" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Telefono</option>
            <option value="walk_in">Mostrador</option>
            <option value="online">Online futuro</option>
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
    </section>
  );
}
