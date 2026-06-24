import type { AppointmentSource, AppointmentStatus, PetSize, Role, Species } from "./types";

export const roleLabels: Record<Role, string> = {
  manager: "Gerencia",
  staff: "Atencion",
  groomer: "Groomer"
};

export const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  checked_in: "Ingresada",
  in_progress: "En grooming",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistio"
};

export const statusTone: Record<AppointmentStatus, string> = {
  scheduled: "bg-slate-100 text-slate-700",
  confirmed: "bg-sky-100 text-sky-800",
  checked_in: "bg-amber-100 text-amber-900",
  in_progress: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  no_show: "bg-zinc-200 text-zinc-800"
};

export const sourceLabels: Record<AppointmentSource, string> = {
  whatsapp: "WhatsApp",
  phone: "Telefono",
  walk_in: "Mostrador",
  online: "Online futuro"
};

export const sizeLabels: Record<PetSize, string> = {
  pequeno: "Pequeno",
  mediano: "Mediano",
  grande: "Grande",
  gigante: "Gigante"
};

export const speciesLabels: Record<Species, string> = {
  perro: "Perro",
  gato: "Gato",
  otro: "Otro"
};
