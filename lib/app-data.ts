import "server-only";

import type { AppData } from "./types";
import { appData as seedData } from "./seed-data";
import { prisma } from "./prisma";

function toIso(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

type DbBranch = AppData["branches"][number];
type DbUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: AppData["users"][number]["role"];
  active: boolean;
  calendarColor: string | null;
  userBranches: { branchId: number }[];
};
type DbCustomer = AppData["customers"][number];
type DbPet = {
  id: number;
  customerId: number;
  name: string;
  species: AppData["pets"][number]["species"];
  breed: string;
  size: AppData["pets"][number]["size"];
  profilePhotoUrl: string | null;
  birthdate: Date | null;
  ageEstimate: string | null;
  healthNotes: string;
  behaviorNotes: string;
};
type DbService = AppData["services"][number];
type DbAppointment = Omit<AppData["appointments"][number], "scheduledStart" | "scheduledEnd" | "serviceIds"> & {
  scheduledStart: Date;
  scheduledEnd: Date;
  services: { serviceId: number }[];
};
type DbGroomingRecord = Omit<
  AppData["groomingRecords"][number],
  | "actualStart"
  | "actualEnd"
  | "intakeSignedAt"
  | "completionSignedAt"
> & {
  actualStart: Date | null;
  actualEnd: Date | null;
  intakeSignedAt: Date | null;
  completionSignedAt: Date | null;
};
type DbReminderLog = Omit<AppData["reminderLogs"][number], "timestamp"> & {
  timestamp: Date;
};

async function loadFromDatabase(): Promise<AppData> {
  const [branches, users, customers, pets, services, appointments, groomingRecords, reminderLogs] =
    await Promise.all([
      prisma.branch.findMany({ orderBy: { id: "asc" } }),
      prisma.user.findMany({
        orderBy: { id: "asc" },
        include: {
          userBranches: {
            select: { branchId: true }
          }
        }
      }),
      prisma.customer.findMany({ orderBy: { id: "asc" } }),
      prisma.pet.findMany({ orderBy: { id: "asc" } }),
      prisma.service.findMany({ orderBy: { id: "asc" } }),
      prisma.appointment.findMany({
        orderBy: { id: "asc" },
        include: {
          services: {
            select: { serviceId: true }
          }
        }
      }),
      prisma.groomingRecord.findMany({ orderBy: { id: "asc" } }),
      prisma.reminderLog.findMany({ orderBy: { id: "asc" } })
    ]);

  const dbBranches = branches as DbBranch[];
  const dbUsers = users as DbUser[];
  const dbCustomers = customers as DbCustomer[];
  const dbPets = pets as DbPet[];
  const dbServices = services as DbService[];
  const dbAppointments = appointments as DbAppointment[];
  const dbGroomingRecords = groomingRecords as DbGroomingRecord[];
  const dbReminderLogs = reminderLogs as DbReminderLog[];

  return {
    branches: dbBranches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      active: branch.active
    })),
    users: dbUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      branchIds: user.userBranches.map((branch) => branch.branchId),
      active: user.active,
      calendarColor: user.calendarColor ? (user.calendarColor as `#${string}`) : undefined
    })),
    customers: dbCustomers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      whatsappOptIn: customer.whatsappOptIn,
      notes: customer.notes
    })),
    pets: dbPets.map((pet) => ({
      id: pet.id,
      customerId: pet.customerId,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      size: pet.size,
      profilePhotoUrl: pet.profilePhotoUrl ?? undefined,
      birthdate: toIso(pet.birthdate),
      ageEstimate: pet.ageEstimate ?? undefined,
      healthNotes: pet.healthNotes,
      behaviorNotes: pet.behaviorNotes
    })),
    services: dbServices.map((service) => ({
      id: service.id,
      name: service.name,
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      active: service.active
    })),
    appointments: dbAppointments.map((appointment) => ({
      id: appointment.id,
      branchId: appointment.branchId,
      petId: appointment.petId,
      groomerId: appointment.groomerId,
      serviceIds: appointment.services.map((service) => service.serviceId),
      scheduledStart: appointment.scheduledStart.toISOString(),
      scheduledEnd: appointment.scheduledEnd.toISOString(),
      status: appointment.status,
      source: appointment.source,
      notes: appointment.notes,
      createdById: appointment.createdById
    })),
    groomingRecords: dbGroomingRecords.map((record) => ({
      id: record.id,
      appointmentId: record.appointmentId,
      actualStart: toIso(record.actualStart),
      actualEnd: toIso(record.actualEnd),
      groomerNotes: record.groomerNotes,
      outcome: record.outcome,
      intakeSignatureName: record.intakeSignatureName ?? undefined,
      intakeSignatureImageUrl: record.intakeSignatureImageUrl ?? undefined,
      intakeSignedAt: toIso(record.intakeSignedAt),
      completionSignatureName: record.completionSignatureName ?? undefined,
      completionSignatureImageUrl: record.completionSignatureImageUrl ?? undefined,
      completionSignedAt: toIso(record.completionSignedAt),
      satisfactionNotes: record.satisfactionNotes,
      beforePhotoUrl: record.beforePhotoUrl ?? undefined,
      afterPhotoUrl: record.afterPhotoUrl ?? undefined
    })),
    reminderLogs: dbReminderLogs.map((log) => ({
      id: log.id,
      appointmentId: log.appointmentId,
      channel: "whatsapp" as const,
      messageTemplate: log.messageTemplate,
      manualStatus: log.manualStatus,
      timestamp: log.timestamp.toISOString()
    }))
  };
}

export async function getAppData(): Promise<AppData> {
  if (!process.env.DATABASE_URL) {
    return seedData;
  }

  try {
    return await loadFromDatabase();
  } catch (error) {
    console.warn("Falling back to seed data because the database query failed.", error);
    return seedData;
  }
}
