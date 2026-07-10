"use client";

import Image from "next/image";
import { useState } from "react";
import { Camera, CheckCircle2, PenLine, Search, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { formatGuatemalaDateTime, getAppointmentDetails, getPetHistory } from "@/lib/business-rules";
import { sizeLabels, speciesLabels, statusLabels } from "@/lib/labels";
import { appData } from "@/lib/seed-data";

export default function MascotasPage() {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const pets = appData.pets
    .map((pet) => {
      const customer = appData.customers.find((item) => item.id === pet.customerId);
      const history = getPetHistory(appData, pet.id);
      return { pet, customer, history };
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

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Expedientes"
          title="Mascotas"
          description="Busca mascotas por nombre o por su dueño, y abre su expediente con datos de grooming, salud y comportamiento."
        />

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
                placeholder="Buscar por mascota, dueño o telefono"
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
                            {history.length} cita{history.length === 1 ? "" : "s"}
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
                      <p className="font-semibold text-ink">Historial reciente</p>
                      {history.slice(0, 2).map((appointment) => (
                        <p key={appointment.id}>
                          {appointment.scheduledStart.slice(0, 10)} · {statusLabels[appointment.status]}
                        </p>
                      ))}
                    </div>
                  </div>
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
                  <div className="mt-4 rounded-lg bg-white p-3">
                    <p className="font-semibold text-ink">Historial de servicios</p>
                    <div className="mt-3 space-y-3">
                      {history.map((appointment) => {
                        const { branch, groomingRecord, groomer, services } = getAppointmentDetails(appData, appointment);
                        const hasPhotos = Boolean(groomingRecord?.beforePhotoUrl || groomingRecord?.afterPhotoUrl);
                        const hasFinalSignature = Boolean(groomingRecord?.completionSignatureName);

                        return (
                          <div key={appointment.id} className="rounded-lg border border-slate-200 bg-cloud/40 p-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-ink">
                                  {formatGuatemalaDateTime(appointment.scheduledStart)}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {services.map((service) => service.name).join(", ")} · {groomer.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{branch.name}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">
                                  {statusLabels[appointment.status]}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                                    hasFinalSignature ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {hasFinalSignature ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  ) : (
                                    <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  {hasFinalSignature ? "Firmado" : "Firma pendiente"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                                    hasPhotos ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                                  {hasPhotos ? "Fotos" : "Sin fotos"}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                              <p className="rounded-lg bg-white p-2">
                                <span className="block text-xs font-semibold uppercase text-slate-500">
                                  Indicaciones
                                </span>
                                {appointment.notes}
                              </p>
                              <p className="rounded-lg bg-white p-2">
                                <span className="block text-xs font-semibold uppercase text-slate-500">
                                  Resultado
                                </span>
                                {groomingRecord?.outcome || "Pendiente"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
            {pets.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-cloud px-4 py-10 text-center text-sm text-slate-500">
                No encontramos mascotas con ese filtro.
              </div>
            )}
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
