"use server";

import { revalidatePath } from "next/cache";
import { serviciosActualizar, serviciosEliminar, serviciosInsertar } from "@/lib/rpc/servicios";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validate(formData: FormData) {
  const nombre = text(formData, "nombre");
  const intervalo = text(formData, "intervalo_recordatorio_dias");
  const intervaloRecordatorio = intervalo ? Number(intervalo) : null;
  const adicional = formData.get("es_adicional") !== null;
  const precio = text(formData, "precio");
  if (!nombre || (intervaloRecordatorio !== null && (!Number.isInteger(intervaloRecordatorio) || intervaloRecordatorio < 1)) || (adicional && !/^(?:\d+)(?:\.\d{1,2})?$/.test(precio))) {
    throw new Error("Ingresa datos válidos para el servicio y su precio.");
  }

  return {
    p_nombre: nombre,
    p_intervalo_recordatorio_dias: intervaloRecordatorio,
    p_es_adicional: adicional,
    p_precio: adicional ? precio : null,
    p_activo: formData.get("activo") !== null && formData.get("activo") !== "false"
  };
}

function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe un servicio con ese nombre.";
  if (code === "PV001") return "Los datos del servicio no son válidos.";
  return "No se pudo guardar el servicio.";
}

export async function createServicio(formData: FormData) {
  try {
    const result = await serviciosInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el servicio." };
  }
}

export async function updateServicio(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id < 1) return { error: "El servicio seleccionado no es válido." };
    const result = await serviciosActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el servicio." };
  }
}

export async function deleteServicio(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "El servicio seleccionado no es válido." };
  const result = await serviciosEliminar(id);
  if (result.error) return { error: "No se pudo desactivar el servicio." };
  revalidatePath("/servicios");
  return { ok: true };
}
