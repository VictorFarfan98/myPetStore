"use client";

import { useState } from "react";
import { Search, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getPetHistory } from "@/lib/business-rules";
import { sizeLabels, speciesLabels } from "@/lib/labels";
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
          description="Busca mascotas por nombre o por su owner, y abre su expediente con datos de grooming, salud y comportamiento."
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
                placeholder="Buscar por mascota, owner o telefono"
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
                    <div className="grid gap-2 text-sm text-slate-600 lg:text-right">
                      <p className="font-semibold text-ink">Historial reciente</p>
                      {history.slice(0, 2).map((appointment) => (
                        <p key={appointment.id}>
                          {appointment.scheduledStart.slice(0, 10)} · {appointment.status}
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
