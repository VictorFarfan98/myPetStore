import Image from "next/image";
import { Camera, CheckCircle2, ClipboardCheck, PenLine, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { formatGuatemalaDateTime, getAppointmentDetails, minutesBetween } from "@/lib/business-rules";
import { appData } from "@/lib/seed-data";

const serviceSheets = appData.appointments
  .map((appointment) => ({
    appointment,
    ...getAppointmentDetails(appData, appointment)
  }))
  .sort(
    (first, second) =>
      new Date(second.appointment.scheduledStart).getTime() -
      new Date(first.appointment.scheduledStart).getTime()
  );

function SignatureStatus({ label, name, signedAt }: { label: string; name?: string; signedAt?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {name ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <PenLine className="h-4 w-4 text-amber-600" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold text-ink">{label}</p>
      </div>
      <p className="mt-2 text-sm text-slate-600">{name ?? "Pendiente de firma"}</p>
      {signedAt && <p className="mt-1 text-xs text-slate-500">{formatGuatemalaDateTime(signedAt)}</p>}
    </div>
  );
}

function PhotoSlot({ label, photoUrl }: { label: string; photoUrl?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-[4/3] bg-cloud">
        {photoUrl ? (
          <Image src={photoUrl} alt={label} fill sizes="(min-width: 1024px) 18rem, 50vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Camera className="h-7 w-7" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="px-3 py-2 text-sm font-semibold text-ink">{label}</p>
    </div>
  );
}

export default function HojasPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Operacion diaria"
          title="Hojas de servicio"
          description="Registro digital de servicios comprados, indicaciones, fotos y firmas de entrega y conformidad."
        />

        <section className="mt-6 space-y-4">
          {serviceSheets.map(({ appointment, branch, customer, groomer, groomingRecord, pet, services }) => {
            const elapsedMinutes = minutesBetween(groomingRecord?.actualStart, groomingRecord?.actualEnd);

            return (
              <article key={appointment.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex gap-3">
                    {pet.profilePhotoUrl ? (
                      <Image
                        src={pet.profilePhotoUrl}
                        alt={`Foto de ${pet.name}`}
                        width={72}
                        height={72}
                        className="h-[72px] w-[72px] shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-cloud text-jade">
                        <UserRound className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-ink">{pet.name}</h2>
                        <StatusPill status={appointment.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {customer?.name} · {customer?.phone} · {branch.name}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {services.map((service) => service.name).join(", ")}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatGuatemalaDateTime(appointment.scheduledStart)} · {groomer.name}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 xl:w-[28rem]">
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-xs font-semibold uppercase text-slate-500">Inicio real</span>
                      {groomingRecord?.actualStart ? formatGuatemalaDateTime(groomingRecord.actualStart) : "Pendiente"}
                    </p>
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-xs font-semibold uppercase text-slate-500">Fin real</span>
                      {groomingRecord?.actualEnd ? formatGuatemalaDateTime(groomingRecord.actualEnd) : "Pendiente"}
                    </p>
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-xs font-semibold uppercase text-slate-500">Duracion</span>
                      {elapsedMinutes ? `${elapsedMinutes} min` : "Pendiente"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-cloud/40 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-ink">Indicaciones del owner</p>
                      <p className="mt-1">{appointment.notes}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-ink">Notas del groomer</p>
                        <p className="mt-1">{groomingRecord?.groomerNotes || "Sin notas todavia."}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-ink">Resultado</p>
                        <p className="mt-1">{groomingRecord?.outcome || "Pendiente de completar."}</p>
                      </div>
                    </div>
                    {groomingRecord?.satisfactionNotes && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">Conformidad final</p>
                        <p className="mt-1">{groomingRecord.satisfactionNotes}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SignatureStatus
                        label="Entregado por owner"
                        name={groomingRecord?.intakeSignatureName}
                        signedAt={groomingRecord?.intakeSignedAt}
                      />
                      <SignatureStatus
                        label="Conforme al finalizar"
                        name={groomingRecord?.completionSignatureName}
                        signedAt={groomingRecord?.completionSignedAt}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PhotoSlot label="Antes" photoUrl={groomingRecord?.beforePhotoUrl} />
                      <PhotoSlot label="Despues" photoUrl={groomingRecord?.afterPhotoUrl} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </PageContainer>
    </AppShell>
  );
}
