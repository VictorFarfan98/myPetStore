import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  canTransitionStatus,
  getCompletedByBranch,
  getCompletedByGroomer,
  hasGroomerConflict
} from "./business-rules";

const appData = {
  branches: [
    { id: 1, name: "Sucursal Zona 10", address: "Guatemala", phone: "+50220000001", active: true }
  ],
  users: [
    {
      id: 3,
      name: "Luis Gomez",
      email: "luis@petstore.gt",
      phone: "+50220000004",
      role: "groomer" as const,
      branchIds: [1],
      active: true,
      calendarColor: "#0F766E"
    }
  ],
  customers: [{ id: 1, name: "Valeria Castillo", phone: "+50255555555", email: "", whatsappOptIn: true, notes: "" }],
  pets: [
    {
      id: 1,
      customerId: 1,
      name: "Luna",
      species: "perro" as const,
      breed: "Poodle",
      size: "mediano" as const,
      healthNotes: "",
      behaviorNotes: ""
    }
  ],
  services: [{ id: 2, name: "Grooming completo", estimatedDurationMinutes: 120, active: true }],
  appointments: [
    {
      id: 1,
      branchId: 1,
      petId: 1,
      groomerId: 3,
      serviceIds: [2],
      scheduledStart: "2026-06-23T09:00:00-06:00",
      scheduledEnd: "2026-06-23T10:50:00-06:00",
      status: "completed" as const,
      source: "whatsapp" as const,
      notes: "",
      createdById: 3
    },
    {
      id: 2,
      branchId: 1,
      petId: 1,
      groomerId: 3,
      serviceIds: [2],
      scheduledStart: "2026-06-23T13:00:00-06:00",
      scheduledEnd: "2026-06-23T14:00:00-06:00",
      status: "scheduled" as const,
      source: "whatsapp" as const,
      notes: "",
      createdById: 3
    }
  ],
  groomingRecords: [
    {
      id: 1,
      appointmentId: 1,
      actualStart: "2026-06-23T09:00:00-06:00",
      actualEnd: "2026-06-23T10:50:00-06:00",
      groomerNotes: "",
      outcome: "",
      satisfactionNotes: "",
      intakePhotoUrls: [],
      completionPhotoUrls: [],
      intakePhotoPaths: [],
      completionPhotoPaths: []
    }
  ],
  reminderLogs: []
};

describe("grooming business rules", () => {
  it("allows only supported appointment lifecycle transitions", () => {
    expect(canTransitionStatus("scheduled", "confirmed")).toBe(true);
    expect(canTransitionStatus("confirmed", "checked_in")).toBe(true);
    expect(canTransitionStatus("checked_in", "in_progress")).toBe(true);
    expect(canTransitionStatus("in_progress", "completed")).toBe(true);
    expect(canTransitionStatus("completed", "scheduled")).toBe(false);
    expect(canTransitionStatus("scheduled", "completed")).toBe(false);
  });

  it("detects groomer double-booking for active appointments", () => {
    const conflict = hasGroomerConflict(appData.appointments, {
      groomerId: 3,
      scheduledStart: "2026-06-23T13:30:00-06:00",
      scheduledEnd: "2026-06-23T14:00:00-06:00"
    });

    expect(conflict).toBe(true);
  });

  it("ignores completed appointments when checking conflicts", () => {
    const conflict = hasGroomerConflict(appData.appointments, {
      groomerId: 3,
      scheduledStart: "2026-06-23T09:30:00-06:00",
      scheduledEnd: "2026-06-23T10:00:00-06:00"
    });

    expect(conflict).toBe(false);
  });

  it("generates a Spanish WhatsApp-ready reminder", () => {
    const message = buildReminderMessage({
      customerName: "Roberto",
      petName: "Max",
      branchName: "Sucursal Zona 10",
      appointmentStart: "2026-06-23T13:00:00-06:00",
      serviceNames: ["Baño medicado", "Corte de uñas"]
    });

    expect(message).toContain("Hola Roberto");
    expect(message).toContain("Max");
    expect(message).toContain("CONFIRMAR");
    expect(message).toContain("REPROGRAMAR");
  });

  it("summarizes completed work by groomer and branch", () => {
    expect(getCompletedByGroomer(appData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groomer: expect.objectContaining({ id: 3 }),
          completed: 1,
          averageDuration: 110
        })
      ])
    );

    expect(getCompletedByBranch(appData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branch: expect.objectContaining({ id: 1 }),
          completed: 1
        })
      ])
    );
  });
});
