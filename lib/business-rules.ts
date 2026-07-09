import type {
  AppData,
  Appointment,
  AppointmentStatus,
  Branch,
  GroomingRecord,
  Pet,
  Service,
  User
} from "./types";
import { statusLabels } from "./labels";

const terminalStatuses: AppointmentStatus[] = ["completed", "cancelled", "no_show"];

export const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: []
};

export function canTransitionStatus(from: AppointmentStatus, to: AppointmentStatus) {
  return allowedTransitions[from].includes(to);
}

export function isTerminalStatus(status: AppointmentStatus) {
  return terminalStatuses.includes(status);
}

export function hasGroomerConflict(
  appointments: Appointment[],
  candidate: Pick<Appointment, "groomerId" | "scheduledStart" | "scheduledEnd"> & { id?: number }
) {
  const start = new Date(candidate.scheduledStart).getTime();
  const end = new Date(candidate.scheduledEnd).getTime();

  return appointments.some((appointment) => {
    if (appointment.id === candidate.id) return false;
    if (appointment.groomerId !== candidate.groomerId) return false;
    if (isTerminalStatus(appointment.status)) return false;

    const appointmentStart = new Date(appointment.scheduledStart).getTime();
    const appointmentEnd = new Date(appointment.scheduledEnd).getTime();
    return start < appointmentEnd && end > appointmentStart;
  });
}

export function formatGuatemalaDateTime(isoDate: string) {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
}

export function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export function buildReminderMessage(args: {
  customerName: string;
  petName: string;
  branchName: string;
  appointmentStart: string;
  serviceNames: string[];
}) {
  const services = args.serviceNames.join(", ");
  return `Hola ${args.customerName}, le recordamos la cita de grooming de ${args.petName} para ${services} en ${args.branchName}, ${formatGuatemalaDateTime(args.appointmentStart)}. Responda CONFIRMAR para confirmar o REPROGRAMAR si necesita otra hora.`;
}

export function getAppointmentDetails(data: AppData, appointment: Appointment) {
  const branch = data.branches.find((item) => item.id === appointment.branchId) as Branch;
  const pet = data.pets.find((item) => item.id === appointment.petId) as Pet;
  const customer = data.customers.find((item) => item.id === pet.customerId);
  const groomer = data.users.find((item) => item.id === appointment.groomerId) as User;
  const services = appointment.serviceIds
    .map((serviceId) => data.services.find((item) => item.id === serviceId))
    .filter(Boolean) as Service[];
  const groomingRecord = data.groomingRecords.find(
    (record) => record.appointmentId === appointment.id
  ) as GroomingRecord | undefined;

  return { branch, pet, customer, groomer, services, groomingRecord };
}

export function getStatusCounts(appointments: Appointment[]) {
  const counts = Object.fromEntries(
    Object.keys(statusLabels).map((status) => [status, 0])
  ) as Record<AppointmentStatus, number>;

  appointments.forEach((appointment) => {
    counts[appointment.status] += 1;
  });

  return counts;
}

export function getCompletedByGroomer(data: AppData) {
  return data.users
    .filter((user) => user.role === "groomer")
    .map((groomer) => {
      const completed = data.appointments.filter(
        (appointment) => appointment.groomerId === groomer.id && appointment.status === "completed"
      );
      const durations = completed
        .map((appointment) => {
          const record = data.groomingRecords.find((item) => item.appointmentId === appointment.id);
          return minutesBetween(record?.actualStart, record?.actualEnd);
        })
        .filter((duration): duration is number => duration !== null);

      const averageDuration =
        durations.length > 0
          ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length)
          : 0;

      return {
        groomer,
        completed: completed.length,
        averageDuration
      };
    });
}

export function getCompletedByBranch(data: AppData) {
  return data.branches.map((branch) => ({
    branch,
    completed: data.appointments.filter(
      (appointment) => appointment.branchId === branch.id && appointment.status === "completed"
    ).length,
    upcoming: data.appointments.filter(
      (appointment) =>
        appointment.branchId === branch.id &&
        !isTerminalStatus(appointment.status) &&
        new Date(appointment.scheduledStart).getTime() >= Date.now()
    ).length
  }));
}

export function getPetHistory(data: AppData, petId: number) {
  return data.appointments
    .filter((appointment) => appointment.petId === petId)
    .sort(
      (first, second) =>
        new Date(second.scheduledStart).getTime() - new Date(first.scheduledStart).getTime()
    );
}
