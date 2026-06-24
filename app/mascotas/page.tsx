import { PawPrint } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getPetHistory } from "@/lib/business-rules";
import { sizeLabels, speciesLabels } from "@/lib/labels";
import { appData } from "@/lib/seed-data";

export default function MascotasPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Expedientes"
          title="Mascotas"
          description="Consulta datos de mascotas, historial de grooming y notas de salud o comportamiento antes del check-in."
        />

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">Perfiles de mascotas</h2>
              <p className="text-sm text-slate-500">Informacion operativa para atenderlas con cuidado.</p>
            </div>
            <PawPrint className="h-5 w-5 text-jade" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {appData.pets.map((pet) => {
              const customer = appData.customers.find((item) => item.id === pet.customerId);
              const history = getPetHistory(appData, pet.id);
              return (
                <article key={pet.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{pet.name}</h3>
                      <p className="text-sm text-slate-500">
                        {speciesLabels[pet.species]} · {pet.breed} · {sizeLabels[pet.size]}
                      </p>
                    </div>
                    <span className="rounded-full bg-cloud px-2.5 py-1 text-xs font-semibold text-jade">
                      {history.length} cita{history.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{customer?.name} · {customer?.phone}</p>
                  <div className="mt-3 rounded-lg bg-cloud p-3 text-sm text-slate-700">
                    <p className="font-semibold text-ink">Salud</p>
                    <p>{pet.healthNotes}</p>
                    <p className="mt-2 font-semibold text-ink">Comportamiento</p>
                    <p>{pet.behaviorNotes}</p>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    <p className="font-semibold text-ink">Ultimas citas</p>
                    {history.slice(0, 2).map((appointment) => (
                      <p key={appointment.id} className="mt-1">
                        {appointment.scheduledStart.slice(0, 10)} · {appointment.status}
                      </p>
                    ))}
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
