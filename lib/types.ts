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
  id: number;
  name: string;
  address: string;
  phone: string;
  active: boolean;
};

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  branchIds: number[];
  active: boolean;
  calendarColor?: `#${string}`;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  whatsappOptIn: boolean;
  notes: string;
};

export type Pet = {
  id: number;
  customerId: number;
  name: string;
  species: Species;
  breed: string;
  size: PetSize;
  profilePhotoUrl?: string;
  birthdate?: string;
  ageEstimate?: string;
  healthNotes: string;
  behaviorNotes: string;
};

export type Service = {
  id: number;
  name: string;
  estimatedDurationMinutes: number;
  active: boolean;
};

export type Appointment = {
  id: number;
  branchId: number;
  petId: number;
  groomerId: number;
  serviceIds: number[];
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string;
  createdById: number;
};

export type GroomingRecord = {
  id: number;
  appointmentId: number;
  actualStart?: string;
  actualEnd?: string;
  groomerNotes: string;
  outcome: string;
  intakeSignatureName?: string;
  intakeSignatureImageUrl?: string;
  intakeSignedAt?: string;
  completionSignatureName?: string;
  completionSignatureImageUrl?: string;
  completionSignedAt?: string;
  satisfactionNotes: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
};

export type ReminderLog = {
  id: number;
  appointmentId: number;
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
