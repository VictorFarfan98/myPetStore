import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPin,
  MessageCircle,
  PawPrint,
  Scissors,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-card";
import { ScheduleForm } from "@/components/schedule-form";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import {
  formatGuatemalaDateTime,
  getAppointmentDetails,
  getCompletedByBranch,
  getCompletedByGroomer,
  getPetHistory,
  getStatusCounts
} from "@/lib/business-rules";
import { roleLabels, sizeLabels, speciesLabels, statusLabels } from "@/lib/labels";
import { appData } from "@/lib/seed-data";

const today = "2026-06-23";
const todaysAppointments = appData.appointments.filter((appointment) =>
  appointment.scheduledStart.startsWith(today)
);
const statusCounts = getStatusCounts(todaysAppointments);
const completedByGroomer = getCompletedByGroomer(appData);
const completedByBranch = getCompletedByBranch(appData);
const nextAppointments = [...appData.appointments].sort(
  (first, second) => new Date(first.scheduledStart).getTime() - new Date(second.scheduledStart).getTime()
);

export default function Home() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-coral">Operacion de grooming</p>
            <h1 className="mt-1 text-3xl font-semibold text-ink">Panel de sucursales y groomers</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Agenda interna para reservas por WhatsApp, telefono y mostrador, con perfiles de mascotas,
              notas de manejo y reportes de trabajo por sucursal.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-panel">
            <p className="font-semibold text-ink">Zona horaria</p>
            <p className="text-slate-500">America/Guatemala · Espanol GT</p>
          </div>
        </header>

        <section id="panel" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Citas de hoy"
            value={todaysAppointments.length}
            hint="En todas las sucursales activas"
            icon={CalendarClock}
          />
          <StatCard
            label="Completadas"
            value={statusCounts.completed}
            hint="Groomings cerrados hoy"
            icon={CheckCircle2}
          />
          <StatCard
            label="En proceso"
            value={statusCounts.in_progress + statusCounts.checked_in}
            hint="Mascotas ingresadas o en mesa"
            icon={Scissors}
          />
          <StatCard
            label="No-show/canceladas"
            value={statusCounts.no_show + statusCounts.cancelled}
            hint="Base para seguimiento operativo"
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
                <h2 className="text-xl font-semibold text-ink">Accesos por rol</h2>
                <p className="text-sm text-slate-500">Base para permisos de v1.</p>
              </div>
              <UsersRound className="h-5 w-5 text-jade" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {appData.users.slice(0, 4).map((user) => (
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

        <section className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <ScheduleForm />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Proximas citas</h2>
                <p className="text-sm text-slate-500">Vista rapida para mostrador y groomers.</p>
              </div>
              <Clock3 className="h-5 w-5 text-jade" aria-hidden="true" />
            </div>
            <div className="mt-5 space-y-4">
              {nextAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} data={appData} appointment={appointment} />
              ))}
            </div>
          </section>
        </section>

        <section id="mascotas" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">Perfiles de mascotas</h2>
              <p className="text-sm text-slate-500">Historial, salud y manejo visibles antes de recibir la mascota.</p>
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
                </article>
              );
            })}
          </div>
        </section>

        <section id="reportes" className="mt-6 grid gap-4 lg:grid-cols-2">
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

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">WhatsApp manual</h2>
              <p className="text-sm text-slate-500">Plantillas listas para copiar y auditar hasta conectar API.</p>
            </div>
            <MessageCircle className="h-5 w-5 text-jade" aria-hidden="true" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {appData.reminderLogs.map((reminder) => {
              const appointment = appData.appointments.find((item) => item.id === reminder.appointmentId)!;
              const { pet, customer } = getAppointmentDetails(appData, appointment);
              return (
                <article key={reminder.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-ink">{customer?.name} · {pet.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatGuatemalaDateTime(reminder.timestamp)} · {reminder.manualStatus}
                  </p>
                  <p className="mt-3 rounded-lg bg-cloud p-3 text-sm leading-6 text-slate-700">
                    {reminder.messageTemplate}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
