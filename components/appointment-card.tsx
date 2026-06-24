import { Clock3, MapPin, MessageCircle, UserRound } from "lucide-react";
import { formatGuatemalaDateTime, getAppointmentDetails } from "@/lib/business-rules";
import { sourceLabels } from "@/lib/labels";
import type { AppData, Appointment } from "@/lib/types";
import { StatusPill } from "./status-pill";

export function AppointmentCard({
  data,
  appointment
}: {
  data: AppData;
  appointment: Appointment;
}) {
  const { branch, pet, customer, groomer, services } = getAppointmentDetails(data, appointment);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{pet.name}</h3>
          <p className="text-sm text-slate-500">
            {services.map((service) => service.name).join(", ")}
          </p>
        </div>
        <StatusPill status={appointment.status} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-jade" aria-hidden="true" />
          {formatGuatemalaDateTime(appointment.scheduledStart)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-jade" aria-hidden="true" />
          {branch.name}
        </p>
        <p className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-jade" aria-hidden="true" />
          {groomer.name}
        </p>
        <p className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-jade" aria-hidden="true" />
          {customer?.name} · {sourceLabels[appointment.source]}
        </p>
      </div>
      {(pet.healthNotes || pet.behaviorNotes || appointment.notes) && (
        <div className="mt-4 rounded-lg bg-cloud p-3 text-sm text-slate-700">
          <p className="font-semibold text-ink">Notas visibles en check-in</p>
          <p className="mt-1">{pet.healthNotes}</p>
          <p className="mt-1">{pet.behaviorNotes}</p>
          <p className="mt-1">{appointment.notes}</p>
        </div>
      )}
    </article>
  );
}
