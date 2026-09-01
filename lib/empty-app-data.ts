import type { AppData } from "./types";

export const emptyAppData: AppData = {
  currentUserRole: undefined,
  currentGroomerId: undefined,
  ratingsEnabled: true,
  branches: [],
  users: [],
  customers: [],
  pets: [],
  sizes: [],
  services: [],
  paymentMethods: [],
  payments: [],
  appointments: [],
  groomingRecords: [],
  reminderLogs: []
};
