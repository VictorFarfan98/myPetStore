"use server";

import { revalidatePath } from "next/cache";
import { citasActualizar, citasCancelar, citasEliminar, citasInsertar } from "@/lib/rpc/citas";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function id(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function dateTime(formData: FormData) {
  const date = text(formData, "fecha");
  const time = text(formData, "hora");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("La fecha y hora de la cita no son válidas.");
  return `${date}T${time}:00-06:00`;
}

function source(formData: FormData) {
  const value = text(formData, "origen");
  if (!["whatsapp", "telefono", "presencial", "google", "pauta_whatsapp", "pauta_instagram", "servicio_domicilio"].includes(value)) throw new Error("El origen de la cita no es válido.");
  return value;
}

function params(formData: FormData) {
  const mascotaId = id(formData, "mascota_id");
  const sucursalId = id(formData, "sucursal_id");
  const peluqueroId = id(formData, "peluquero_id");
  const servicioId = id(formData, "servicio_id");
  if (!mascotaId || !sucursalId || !peluqueroId || !servicioId) throw new Error("Completa sucursal, mascota, groomer y servicio.");
  return { p_mascota_id: mascotaId, p_sucursal_id: sucursalId, p_peluquero_id: peluqueroId, p_servicio_id: servicioId, p_inicio_programado: dateTime(formData), p_origen: source(formData) };
}

function errorMessage(code?: string) {
  if (code === "PV001") return "Los datos de la cita no son válidos.";
  if (code === "PN001") return "No existe la configuración de precio y duración para este servicio.";
  return "No se pudo guardar la cita.";
}

export async function createCita(formData: FormData) {
  try {
    const result = await citasInsertar(params(formData));
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/agenda");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la cita." };
  }
}

export async function updateCita(formData: FormData) {
  const citaId = id(formData, "id");
  if (!citaId) return { error: "La cita seleccionada no es válida." };
  try {
    const base = params(formData);
    const fin = text(formData, "fin_programado");
    const estado = text(formData, "estado");
    if (!fin || Number.isNaN(Date.parse(fin)) || !["programada", "atendida", "cancelada", "no_asistio"].includes(estado)) throw new Error("Los datos de actualización de la cita no son válidos.");
    const result = await citasActualizar({ ...base, p_id: citaId, p_fin_programado: fin, p_estado: estado, p_activo: true });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/agenda");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la cita." };
  }
}

export async function deleteCita(formData: FormData) {
  const citaId = id(formData, "id");
  if (!citaId) return { error: "La cita seleccionada no es válida." };
  const result = await citasEliminar(citaId);
  if (result.error) return { error: "No se pudo desactivar la cita." };
  revalidatePath("/agenda");
  return { ok: true };
}

export async function cancelCita(formData: FormData) {
  const citaId = id(formData, "cita_id");
  const motivo = text(formData, "motivo");
  if (!citaId) return { error: "La cita seleccionada no es válida." };
  if (!motivo) return { error: "Escribe un motivo para cancelar la cita." };
  try {
    const result = await citasCancelar({ p_cita_id: citaId, p_motivo: motivo });
    if (result.error) {
      if (result.error.code === "PN001") return { error: "La cita no existe." };
      if (result.error.code === "PV001") return { error: "Escribe un motivo para cancelar la cita." };
      return { error: "No se pudo cancelar la cita." };
    }
    revalidatePath("/agenda");
    revalidatePath("/hojas");
    return { ok: true };
  } catch {
    return { error: "No se pudo cancelar la cita." };
  }
}
