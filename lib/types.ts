export type Role = "manager" | "staff" | "groomer";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentSource = "whatsapp" | "phone" | "walk_in" | "online";

export type PetSize = "pequeno" | "mediano" | "grande" | "gigante";

export type Species = "perro" | "gato" | "otro";

export type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  branchIds: string[];
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsappOptIn: boolean;
  notes: string;
};

export type Pet = {
  id: string;
  customerId: string;
  name: string;
  species: Species;
  breed: string;
  size: PetSize;
  birthdate?: string;
  ageEstimate?: string;
  healthNotes: string;
  behaviorNotes: string;
};

export type Service = {
  id: string;
  name: string;
  estimatedDurationMinutes: number;
  active: boolean;
};

export type Appointment = {
  id: string;
  branchId: string;
  petId: string;
  groomerId: string;
  serviceIds: string[];
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string;
  createdById: string;
};

export type GroomingRecord = {
  id: string;
  appointmentId: string;
  actualStart?: string;
  actualEnd?: string;
  groomerNotes: string;
  outcome: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
};

export type ReminderLog = {
  id: string;
  appointmentId: string;
  channel: "whatsapp";
  messageTemplate: string;
  manualStatus: "drafted" | "sent" | "skipped";
  timestamp: string;
};

export type AppData = {
  branches: Branch[];
  users: User[];
  customers: Customer[];
  pets: Pet[];
  services: Service[];
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  reminderLogs: ReminderLog[];
};
