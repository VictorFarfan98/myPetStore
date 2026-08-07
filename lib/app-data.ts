import "server-only";

import { createUserSupabaseClient } from "./supabase/server";
import { emptyAppData } from "./empty-app-data";
import { rpcCall } from "./rpc/core";
import { RPC_NAMES } from "./rpc/names";
import type {
  CitaRow,
  ClienteRow,
  MascotaRow,
  PrecioServicioRow,
  RegistroServicioRow,
  RecordatorioCitaRow,
  ServicioRow,
  SucursalRow,
  TamanoRow,
  UsuarioRow,
  UsuarioSucursalRow,
  RpcListEnvelope,
  RpcResult
} from "./rpc/types";
import type { AppData, AppointmentSource, AppointmentStatus, PetSize, Role, Species } from "./types";

type PeluqueroRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  color_calendario: string | null;
  activo: boolean;
};

type LoadParams<T> = {
  data: T | null;
  error: unknown;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeSpecies(value: string | null | undefined): Species {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "perro" || normalized === "gato" || normalized === "otro") {
    return normalized;
  }
  return "otro";
}

function normalizeSize(value: string | null | undefined): PetSize {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.includes("pequ")) return "pequeno";
  if (normalized.includes("med")) return "mediano";
  if (normalized.includes("gig")) return "gigante";
  return "grande";
}

function normalizeRole(value: string | null | undefined): Role {
  if (value === "encargado") return "staff";
  return "manager";
}

function normalizeStatus(cita: CitaRow, registro?: RegistroServicioRow): AppointmentStatus {
  if (registro?.estado === "completado" || cita.estado === "atendida") return "completed";
  if (registro?.estado === "en_progreso") return "in_progress";
  if (cita.estado === "cancelada") return "cancelled";
  if (cita.estado === "no_asistio") return "no_show";
  return "scheduled";
}

function normalizeSource(value: string | null | undefined): AppointmentSource {
  if (value === "telefono") return "phone";
  if (value === "presencial") return "walk_in";
  if (value === "whatsapp") return "whatsapp";
  return "online";
}

function colorForIndex(index: number) {
  const palette = ["#0F766E", "#7C3AED", "#2563EB", "#D97706", "#DB2777", "#059669", "#DC2626"];
  return palette[index % palette.length];
}

function must<T>(value: RpcResult<RpcListEnvelope<T>>, label: string): T[] {
  if (value.error || value.data === null) {
    throw new Error(`Failed to load ${label}: ${value.error?.code ?? "UNKNOWN"} ${value.error?.message ?? "Empty response"}`);
  }

  return value.data.datos;
}

function mapBranch(row: SucursalRow) {
  return {
    id: row.id,
    name: row.nombre,
    address: row.direccion,
    phone: row.telefono,
    active: row.activo
  };
}

function mapCustomer(row: ClienteRow) {
  return {
    id: row.id,
    name: row.nombre,
    phone: row.telefono,
    whatsappOptIn: row.whatsapp_opt_in,
    smsOptIn: row.sms_opt_in,
    notes: normalizeText(row.notas)
  };
}

function mapPet(row: MascotaRow, sizeById: Map<number, string | undefined>) {
  return {
    id: row.id,
    customerId: row.cliente_id,
    name: row.nombre,
    species: normalizeSpecies(row.especie),
    breed: normalizeText(row.raza),
    size: normalizeSize(sizeById.get(row.tamano_id)),
    profilePhotoUrl: row.foto_perfil_url ?? undefined,
    birthdate: toIso(row.fecha_nacimiento),
    ageEstimate: undefined,
    healthNotes: normalizeText(row.notas_salud),
    behaviorNotes: normalizeText(row.notas_comportamiento)
  };
}

function buildUsers(args: {
  users: UsuarioRow[];
  peluqueros: PeluqueroRow[];
  assignments: UsuarioSucursalRow[];
  activeBranchIds: number[];
  appointments: CitaRow[];
  employeeIdMap: Map<string, number>;
  groomerIdMap: Map<number, number>;
}) {
  const employeeBranchMap = new Map<number, number[]>();
  args.assignments.forEach((assignment) => {
    const userId = args.employeeIdMap.get(assignment.usuario_id);
    if (!userId) return;

    const branchIds = employeeBranchMap.get(userId) ?? [];
    if (!branchIds.includes(assignment.sucursal_id)) {
      branchIds.push(assignment.sucursal_id);
      employeeBranchMap.set(userId, branchIds);
    }
  });

  const groomerBranchMap = new Map<number, number[]>();
  args.appointments.forEach((appointment) => {
    if (!appointment.peluquero_id) return;
    const groomerId = args.groomerIdMap.get(appointment.peluquero_id);
    if (!groomerId) return;

    const branchIds = groomerBranchMap.get(groomerId) ?? [];
    if (!branchIds.includes(appointment.sucursal_id)) {
      branchIds.push(appointment.sucursal_id);
      groomerBranchMap.set(groomerId, branchIds);
    }
  });

  const employees = args.users
    .filter((user) => user.activo)
    .sort((a, b) => a.nombre_usuario.localeCompare(b.nombre_usuario))
    .map((user) => {
      const id = args.employeeIdMap.get(user.id) ?? 0;

      return {
        id,
        name: user.nombre,
        email: user.nombre_usuario,
        phone: user.telefono ?? "",
        role: normalizeRole(user.rol),
        branchIds:
          user.rol === "administrador" || user.rol === "propietario"
            ? args.activeBranchIds
            : employeeBranchMap.get(id) ?? [],
        active: user.activo,
        calendarColor: undefined
      };
    });

  const groomers = args.peluqueros
    .filter((row) => row.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((row, index) => {
      const id = args.groomerIdMap.get(row.id) ?? 0;

      return {
        id,
        name: row.nombre,
        email: row.telefono ?? row.nombre,
        phone: row.telefono ?? "",
        role: "groomer" as const,
        branchIds: groomerBranchMap.get(id) ?? args.activeBranchIds,
        active: row.activo,
        calendarColor: row.color_calendario ?? colorForIndex(index)
      };
    });

  return [...employees, ...groomers];
}

function buildAppointments(args: {
  citas: CitaRow[];
  registrosByAppointment: Map<number, RegistroServicioRow>;
  createdByMap: Map<string, number>;
  groomerMap: Map<number, number>;
}) {
  return args.citas
    .filter((cita) => cita.activo)
    .map((cita) => {
      const registro = args.registrosByAppointment.get(cita.id);

      return {
        id: cita.id,
        branchId: cita.sucursal_id,
        petId: cita.mascota_id,
        groomerId: cita.peluquero_id ? args.groomerMap.get(cita.peluquero_id) ?? 0 : 0,
        serviceIds: [cita.servicio_id],
        scheduledStart: cita.inicio_programado,
        scheduledEnd: cita.fin_programado,
        status: normalizeStatus(cita, registro),
        source: normalizeSource(cita.origen),
        notes: normalizeText(registro?.observaciones_ingreso ?? registro?.notas_servicio),
        createdById: args.createdByMap.get(cita.creada_por_usuario_id) ?? 0
      };
    });
}

function buildGroomingRecords(args: {
  registros: RegistroServicioRow[];
  citaById: Map<number, CitaRow>;
  customerNameByPetId: Map<number, string>;
}) {
  return args.registros
    .filter((registro) => registro.activo)
    .map((registro) => {
      const cita = args.citaById.get(registro.cita_id);
      const customerName = cita ? args.customerNameByPetId.get(cita.mascota_id) : undefined;

      return {
        id: registro.id,
        appointmentId: registro.cita_id,
        actualStart: toIso(registro.inicio_real),
        actualEnd: toIso(registro.fin_real),
        groomerNotes: normalizeText(registro.notas_servicio),
        outcome: normalizeText(registro.estado),
        intakeSignatureName: customerName,
        intakeSignatureImageUrl: registro.firma_ingreso_url ?? undefined,
        intakeSignedAt: toIso(registro.firma_ingreso_en),
        completionSignatureName: customerName,
        completionSignatureImageUrl: registro.firma_entrega_url ?? undefined,
        completionSignedAt: toIso(registro.firma_entrega_en),
        satisfactionNotes: normalizeText(registro.comentario_satisfaccion),
        beforePhotoUrl: registro.foto_antes_url ?? undefined,
        afterPhotoUrl: registro.foto_despues_url ?? undefined
      };
    });
}

export async function getAppData(): Promise<AppData> {
  try {
    const supabase = await createUserSupabaseClient();

    const [
      branchesResult,
      usersResult,
      peluquerosResult,
      assignmentsResult,
      customersResult,
      petsResult,
      tamanosResult,
      servicesResult,
      preciosServiciosResult,
      citasResult,
      registrosResult,
      reminderLogsResult
    ] = await Promise.all([
      rpcCall<RpcListEnvelope<SucursalRow>>(RPC_NAMES.branchesList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<UsuarioRow>>(RPC_NAMES.usersList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<PeluqueroRow>>(RPC_NAMES.groomersList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<UsuarioSucursalRow>>(RPC_NAMES.userBranchesList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<ClienteRow>>(RPC_NAMES.customersList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<MascotaRow>>(RPC_NAMES.petsList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<TamanoRow>>(RPC_NAMES.sizesList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<ServicioRow>>(RPC_NAMES.servicesList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<PrecioServicioRow>>(RPC_NAMES.servicePricesList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<CitaRow>>(RPC_NAMES.appointmentsList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<RegistroServicioRow>>(RPC_NAMES.groomingRecordsList, { p_limite: null, p_offset: 0 }, supabase),
      rpcCall<RpcListEnvelope<RecordatorioCitaRow>>(RPC_NAMES.reminderLogsList, { p_limite: null, p_offset: 0 }, supabase)
    ]);

    const branches = must(branchesResult, "branches").filter((branch) => branch.activo).map(mapBranch);
    const users = must(usersResult, "usuarios").filter((user) => user.activo);
    const peluqueros = must(peluquerosResult, "peluqueros").filter((row) => row.activo);
    const assignments = must(assignmentsResult, "usuarios_sucursales");
    const customers = must(customersResult, "clientes").filter((customer) => customer.activo).map(mapCustomer);
    const tamanos = must(tamanosResult, "tamanos");
    const pets = must(petsResult, "mascotas").filter((pet) => pet.activo);
    const servicesRows = must(servicesResult, "servicios").filter((service) => service.activo);
    const precioServicios = must(preciosServiciosResult, "precios_servicios");
    const citas = must(citasResult, "citas");
    const registros = must(registrosResult, "registros_servicio");
    const reminderLogs = must(reminderLogsResult, "recordatorios_citas");

    const sizeById = new Map(tamanos.map((row) => [row.id, row.nombre]));
    const customerNameByPetId = new Map<number, string>();
    pets.forEach((pet) => {
      const customerName = customers.find((customer) => customer.id === pet.cliente_id)?.name ?? "";
      customerNameByPetId.set(pet.id, customerName);
    });

    const createdByMap = new Map<string, number>();
    users
      .slice()
      .sort((a, b) => a.nombre_usuario.localeCompare(b.nombre_usuario))
      .forEach((user, index) => {
        createdByMap.set(user.id, index + 1);
      });

    const groomerMap = new Map<number, number>();
    peluqueros
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach((row, index) => {
        groomerMap.set(row.id, row.id);
      });

    const appUsers = buildUsers({
      users,
      peluqueros,
      assignments,
      activeBranchIds: branches.map((branch) => branch.id),
      appointments: citas,
      employeeIdMap: createdByMap,
      groomerIdMap: groomerMap
    });

    const registrosByAppointment = new Map<number, RegistroServicioRow>();
    registros.forEach((registro) => {
      registrosByAppointment.set(registro.cita_id, registro);
    });

    const citaById = new Map<number, CitaRow>();
    citas.forEach((cita) => {
      citaById.set(cita.id, cita);
    });

    const appointments = buildAppointments({
      citas,
      registrosByAppointment,
      createdByMap,
      groomerMap
    });

    const groomingRecords = buildGroomingRecords({
      registros,
      citaById,
      customerNameByPetId
    });

    const serviceDurationById = new Map<number, number>();
    precioServicios.forEach((row) => {
      const current = serviceDurationById.get(row.servicio_id);
      if (current === undefined || row.duracion_minutos < current) {
        serviceDurationById.set(row.servicio_id, row.duracion_minutos);
      }
    });

    const petsData = pets.map((pet) => mapPet(pet, sizeById));

    const services = servicesRows.map((service) => ({
      id: service.id,
      name: service.nombre,
      estimatedDurationMinutes: serviceDurationById.get(service.id) ?? 30,
      active: service.activo
    }));

    return {
      branches,
      users: appUsers,
      customers,
      pets: petsData,
      sizes: tamanos.filter((tamano) => tamano.activo).map((tamano) => ({ id: tamano.id, name: tamano.nombre })),
      services,
      appointments,
      groomingRecords,
      reminderLogs: reminderLogs.map((log) => ({
        id: log.id,
        appointmentId: log.cita_id,
        channel: "whatsapp" as const,
        messageTemplate: log.mensaje,
        manualStatus: "sent" as const,
        timestamp: toIso(log.enviado_en) ?? new Date().toISOString()
      }))
    };
  } catch (error) {
    console.error("Falling back to an empty app state because live RPC data failed.", error);
    return emptyAppData;
  }
}
