"use client";

import { useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { appData } from "@/lib/seed-data";

export default function ClientesPage() {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const customers = appData.customers
    .map((customer) => {
      const pets = appData.pets.filter((pet) => pet.customerId === customer.id);
      return { customer, pets };
    })
    .filter(({ customer, pets }) => {
      if (!normalizedQuery) return true;

      return (
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.phone.toLowerCase().includes(normalizedQuery) ||
        customer.notes.toLowerCase().includes(normalizedQuery) ||
        pets.some(
          (pet) =>
            pet.name.toLowerCase().includes(normalizedQuery) ||
            pet.breed.toLowerCase().includes(normalizedQuery)
        )
      );
    });

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Relacion con clientes"
          title="Clientes"
          description="Busca clientes por nombre, telefono o por sus mascotas asociadas para reutilizarlos al agendar."
        />

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">Directorio de clientes</h2>
              <p className="mt-1 text-sm text-slate-500">
                {customers.length} cliente{customers.length === 1 ? "" : "s"} encontrado{customers.length === 1 ? "" : "s"}.
              </p>
            </div>
            <label className="focus-ring flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm lg:w-[28rem]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, telefono o mascota"
              />
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {customers.map(({ customer, pets }) => {
              return (
                <article
                  key={customer.id}
                  className="rounded-lg border border-slate-200 bg-cloud/30 p-4 transition hover:border-jade/40 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-ink">{customer.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            customer.whatsappOptIn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          {customer.whatsappOptIn ? "WhatsApp" : "Llamada"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{customer.phone}</p>
                      <p className="mt-3 text-sm text-slate-700">{customer.notes}</p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 lg:text-right">
                      <p className="font-semibold text-ink">Mascotas</p>
                      <p>{pets.map((pet) => pet.name).join(", ")}</p>
                      <p className="text-xs text-slate-500">
                        {pets.length} mascota{pets.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
            {customers.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-cloud px-4 py-10 text-center text-sm text-slate-500">
                No encontramos clientes con ese filtro.
              </div>
            )}
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
