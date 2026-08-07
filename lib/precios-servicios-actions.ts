"use server";

import { revalidatePath } from "next/cache";
import { preciosServiciosActualizar, preciosServiciosEliminar, preciosServiciosInsertar } from "@/lib/rpc/precios_servicios";

function number(formData: FormData, name: string) {
  return Number(formData.get(name));
}

function validate(formData: FormData) {
  const servicioId = number(formData, "servicio_id");
  const tamanoId = number(formData, "tamano_id");
  const precio = String(formData.get("precio") ?? "").trim();
  const duracion = number(formData, "duracion_minutos");
  if (!Number.isInteger(servicioId) || servicioId < 1 || !Number.isInteger(tamanoId) || tamanoId < 1 || !/^(?:\d+)(?:\.\d{1,2})?$/.test(precio) || !Number.isInteger(duracion) || duracion < 1) {
    throw new Error("Ingresa un servicio, tamaño, precio y duración válidos.");
  }
  return { p_servicio_id: servicioId, p_tamano_id: tamanoId, p_precio: precio, p_duracion_minutos: duracion, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function errorMessage(error: { code?: string; message?: string }) {
  console.error("Error en RPC de precios_servicios", { code: error.code, message: error.message });
  if (error.code === "PC001") return "Ya existe un precio para ese servicio y tamaño.";
  if (error.code === "PV001") return "Los datos del precio no son válidos.";
  return "No se pudo guardar el precio del servicio.";
}

export async function createPrecioServicio(formData: FormData) {
  try {
    const result = await preciosServiciosInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    console.error("Error al crear precio del servicio", error);
    return { error: error instanceof Error ? error.message : "No se pudo crear el precio del servicio." };
  }
}

export async function updatePrecioServicio(formData: FormData) {
  try {
    const result = await preciosServiciosActualizar(validate(formData));
    if (result.error) return { error: errorMessage(result.error) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    console.error("Error al actualizar precio del servicio", error);
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el precio del servicio." };
  }
}

export async function deletePrecioServicio(formData: FormData) {
  const servicioId = number(formData, "servicio_id");
  const tamanoId = number(formData, "tamano_id");
  if (!Number.isInteger(servicioId) || servicioId < 1 || !Number.isInteger(tamanoId) || tamanoId < 1) return { error: "El precio seleccionado no es válido." };
  const result = await preciosServiciosEliminar(servicioId, tamanoId);
  if (result.error) return { error: errorMessage(result.error) };
  revalidatePath("/servicios");
  return { ok: true };
}
