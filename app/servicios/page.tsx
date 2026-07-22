import { Scissors } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getAppData } from "@/lib/app-data";

export default async function ServiciosPage() {
  const data = await getAppData();

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Catalogo operativo"
          title="Servicios"
          description="Servicios de grooming con duracion estimada para calcular disponibilidad de agenda sin incluir pagos en v1."
        />

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">Plantillas de servicio</h2>
              <p className="text-sm text-slate-500">Base para duracion, agenda y reportes.</p>
            </div>
            <Scissors className="h-5 w-5 text-jade" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.services.map((service) => (
              <article key={service.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cloud text-jade">
                  <Scissors className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{service.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{service.estimatedDurationMinutes} minutos estimados</p>
                <span
                  className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    service.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {service.active ? "Activo" : "Inactivo"}
                </span>
              </article>
            ))}
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
