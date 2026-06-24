import { Clock3, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppointmentCard } from "@/components/appointment-card";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ScheduleForm } from "@/components/schedule-form";
import { formatGuatemalaDateTime, getAppointmentDetails } from "@/lib/business-rules";
import { appData } from "@/lib/seed-data";

const nextAppointments = [...appData.appointments].sort(
  (first, second) => new Date(first.scheduledStart).getTime() - new Date(second.scheduledStart).getTime()
);

export default function AgendaPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Reservas y calendario"
          title="Agenda"
          description="Gestiona nuevas citas, revisa disponibilidad por groomer y prepara confirmaciones manuales por WhatsApp."
        />

        <section className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <ScheduleForm />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-ink">Calendario de citas</h2>
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
      </PageContainer>
    </AppShell>
  );
}
