import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  canTransitionStatus,
  getCompletedByBranch,
  getCompletedByGroomer,
  hasGroomerConflict
} from "./business-rules";
import { appData } from "./seed-data";

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
      groomerId: "user-luis",
      scheduledStart: "2026-06-23T13:30:00-06:00",
      scheduledEnd: "2026-06-23T14:00:00-06:00"
    });

    expect(conflict).toBe(true);
  });

  it("ignores completed appointments when checking conflicts", () => {
    const conflict = hasGroomerConflict(appData.appointments, {
      groomerId: "user-luis",
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
      serviceNames: ["Bano medicado", "Corte de unas"]
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
          groomer: expect.objectContaining({ id: "user-luis" }),
          completed: 1,
          averageDuration: 110
        })
      ])
    );

    expect(getCompletedByBranch(appData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branch: expect.objectContaining({ id: "branch-z10" }),
          completed: 1
        })
      ])
    );
  });
});
