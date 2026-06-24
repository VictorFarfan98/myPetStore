import { statusLabels, statusTone } from "@/lib/labels";
import type { AppointmentStatus } from "@/lib/types";

export function StatusPill({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
