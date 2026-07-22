import { CalendarClock, CheckCircle2, ClipboardList, Scissors, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { getAppData } from "@/lib/app-data";
import { getCompletedByBranch, getCompletedByGroomer, getStatusCounts } from "@/lib/business-rules";
import { roleLabels, statusLabels } from "@/lib/labels";
export default async function DashboardPage() {
  const data = await getAppData();
  const today = "2026-06-23";
  const todaysAppointments = data.appointments.filter((appointment) =>
    appointment.scheduledStart.startsWith(today)
  );
  const statusCounts = getStatusCounts(todaysAppointments);
  const completedByGroomer = getCompletedByGroomer(data);
  const completedByBranch = getCompletedByBranch(data);

  const totalCompleted = completedByGroomer.reduce((total, item) => total + item.completed, 0);
  const upcoming = completedByBranch.reduce((total, item) => total + item.upcoming, 0);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Operacion de grooming"
          title="Panel"
          description="Indicadores principales para entender como va el dia entre sucursales, groomers y citas activas."
          action={
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-panel">
              <p className="font-semibold text-ink">Zona horaria</p>
              <p className="text-slate-500">America/Guatemala · Espanol GT</p>
            </div>
          }
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Citas de hoy"
            value={todaysAppointments.length}
            hint="En todas las sucursales activas"
            icon={CalendarClock}
          />
          <StatCard
            label="Completadas hoy"
            value={statusCounts.completed}
            hint={`${totalCompleted} grooming completo en el historial`}
            icon={CheckCircle2}
          />
          <StatCard
            label="En proceso"
            value={statusCounts.in_progress + statusCounts.checked_in}
            hint="Mascotas ingresadas o en mesa"
            icon={Scissors}
          />
          <StatCard
            label="Proximas"
            value={upcoming}
            hint="Citas futuras abiertas"
            icon={ClipboardList}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Estado del dia</h2>
                <p className="text-sm text-slate-500">Conteo por etapa del flujo de grooming.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-jade" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(statusLabels).map(([status, label]) => (
                <div key={status} className="rounded-lg border border-slate-200 p-3">
                  <StatusPill status={status as keyof typeof statusLabels} />
                  <p className="mt-3 text-2xl font-semibold text-ink">
                    {statusCounts[status as keyof typeof statusCounts]}
                  </p>
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Equipo activo</h2>
                <p className="text-sm text-slate-500">Roles configurados para permisos de v1.</p>
              </div>
              <UsersRound className="h-5 w-5 text-jade" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {data.users.slice(0, 4).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg bg-cloud px-3 py-2">
                  <div>
                    <p className="font-medium text-ink">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-jade">
                    {roleLabels[user.role]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </PageContainer>
    </AppShell>
  );
}
