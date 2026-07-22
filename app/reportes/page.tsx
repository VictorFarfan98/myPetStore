import { MapPin, Scissors } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getAppData } from "@/lib/app-data";
import { getCompletedByBranch, getCompletedByGroomer } from "@/lib/business-rules";

export default async function ReportesPage() {
  const data = await getAppData();
  const completedByGroomer = getCompletedByGroomer(data);
  const completedByBranch = getCompletedByBranch(data);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Medicion operativa"
          title="Reportes"
          description="Revisa volumen completado, proximas citas y duracion promedio por groomer o sucursal."
        />

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Groomings por groomer</h2>
                <p className="text-sm text-slate-500">Volumen y duracion promedio.</p>
              </div>
              <Scissors className="h-5 w-5 text-jade" aria-hidden="true" />
            </div>
            <div className="mt-5 space-y-3">
              {completedByGroomer.map(({ groomer, completed, averageDuration }) => (
                <div key={groomer.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{groomer.name}</p>
                    <p className="text-2xl font-semibold text-jade">{completed}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Promedio: {averageDuration || "-"} min</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Sucursales</h2>
                <p className="text-sm text-slate-500">Completadas y proximas por ubicacion.</p>
              </div>
              <MapPin className="h-5 w-5 text-jade" aria-hidden="true" />
            </div>
            <div className="mt-5 space-y-3">
              {completedByBranch.map(({ branch, completed, upcoming }) => (
                <div key={branch.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{branch.name}</p>
                      <p className="text-sm text-slate-500">{branch.address}</p>
                    </div>
                    <p className="text-sm font-semibold text-jade">{branch.phone}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-slate-500">Completadas</span>
                      <span className="text-xl font-semibold text-ink">{completed}</span>
                    </p>
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-slate-500">Proximas</span>
                      <span className="text-xl font-semibold text-ink">{upcoming}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
