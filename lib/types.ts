export type Role = "manager" | "staff" | "groomer";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentSource = "whatsapp" | "phone" | "walk_in" | "google" | "whatsapp_ad" | "instagram_ad" | "online";

export type PetSize = "pequeno" | "mediano" | "grande" | "gigante" | "pelo_corto" | "pelo_largo";

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
  calendarColor?: string;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  whatsappOptIn: boolean;
  smsOptIn?: boolean;
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

export type ClientesData = {
  customers: Customer[];
  pets: Pick<Pet, "id" | "customerId" | "name" | "breed">[];
};

export type PetSizeOption = { id: number; name: string; species: Species };

export type Service = {
  id: number;
  name: string;
  estimatedDurationMinutes: number;
  generalDurationMinutes?: number;
  price?: string;
  additional?: boolean;
  active: boolean;
};

export type ServiceDuration = { serviceId: number; species: Species; size: PetSize; minutes: number; promotionalPrice?: string };

export type PaymentMethod = { id: number; name: string };
export type ServicePayment = { id: number; recordId: number; methodId: number; amount: string };

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
  serviceId?: number;
  groomerId?: number;
  sizeId?: number;
  additionalServiceIds?: number[];
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
  beforePhotoPath?: string;
  afterPhotoPath?: string;
  finalAmount?: string;
  paidAmount?: string;
  couponId?: string;
  discountAmount?: string;
  usesPromotion?: boolean;
  conditions?: string[];
  parasites?: string[];
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
  ratingsEnabled?: boolean;
  branches: Branch[];
  users: User[];
  customers: Customer[];
  pets: Pet[];
  sizes?: PetSizeOption[];
  services: Service[];
  serviceDurations?: ServiceDuration[];
  paymentMethods?: PaymentMethod[];
  payments?: ServicePayment[];
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  groomingRecordsTotal?: number;
  reminderLogs: ReminderLog[];
};
