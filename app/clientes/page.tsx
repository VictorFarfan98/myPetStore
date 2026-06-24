import { MessageCircle, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { appData } from "@/lib/seed-data";

export default function ClientesPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Relacion con clientes"
          title="Clientes"
          description="Mantiene datos de contacto, preferencia de WhatsApp y mascotas asociadas para reutilizarlas al agendar."
        />

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">Directorio</h2>
              <p className="text-sm text-slate-500">Clientes con opt-in y notas operativas.</p>
            </div>
            <UsersRound className="h-5 w-5 text-jade" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {appData.customers.map((customer) => {
              const pets = appData.pets.filter((pet) => pet.customerId === customer.id);
              return (
                <article key={customer.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{customer.name}</h3>
                      <p className="text-sm text-slate-500">{customer.phone}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        customer.whatsappOptIn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {customer.whatsappOptIn ? "WhatsApp" : "Llamada"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{customer.notes}</p>
                  <div className="mt-4 rounded-lg bg-cloud p-3 text-sm">
                    <p className="font-semibold text-ink">Mascotas</p>
                    <p className="mt-1 text-slate-600">{pets.map((pet) => pet.name).join(", ")}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
