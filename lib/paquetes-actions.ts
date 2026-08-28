"use server";

import { revalidatePath } from "next/cache";
import { paquetesAsignar, paquetesCrear } from "@/lib/rpc/paquetes";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function packageItems(formData: FormData) {
  const raw = text(formData, "servicios");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Agrega al menos un servicio al paquete.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Agrega al menos un servicio al paquete.");

  const items = parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Los servicios y cantidades del paquete no son válidos.");
    const value = item as { servicio_id?: unknown; cantidad?: unknown };
    const servicioId = Number(value.servicio_id);
    const cantidad = Number(value.cantidad);
    if (!Number.isInteger(servicioId) || servicioId < 1 || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      throw new Error("Los servicios y cantidades del paquete no son válidos.");
    }
    return { servicio_id: servicioId, cantidad };
  });
  if (new Set(items.map((item) => item.servicio_id)).size !== items.length) throw new Error("No repitas servicios dentro del paquete.");
  return items;
}

function errorMessage(code?: string, fallback = "No se pudo completar la operación.") {
  if (code === "PA001") return "No tienes permiso para administrar paquetes.";
  if (code === "PC001") return "Ya existe un paquete con ese nombre.";
  if (code === "PN001") return "El paquete o cliente seleccionado no existe o está inactivo.";
  if (code === "PV001") return "Revisa los datos del paquete.";
  return fallback;
}

export async function createPaquete(formData: FormData) {
  try {
    const nombre = text(formData, "nombre");
    const precio = text(formData, "precio");
    const numericPrice = Number(precio);
    if (!nombre || !/^\d+(?:\.\d{1,2})?$/.test(precio) || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      throw new Error("Ingresa un nombre y precio válidos para el paquete.");
    }
    const result = await paquetesCrear({ p_nombre: nombre, p_precio: numericPrice.toFixed(2), p_servicios: packageItems(formData) });
    if (result.error) return { error: errorMessage(result.error.code, "No se pudo crear el paquete.") };
    revalidatePath("/paquetes");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: ["Agrega al menos un servicio al paquete.", "Los servicios y cantidades del paquete no son válidos.", "No repitas servicios dentro del paquete.", "Ingresa un nombre y precio válidos para el paquete."].includes(message) ? message : "No se pudo crear el paquete." };
  }
}

export async function assignPaquete(formData: FormData) {
  const packageId = Number(formData.get("paquete_id"));
  const customerId = Number(formData.get("cliente_id"));
  if (!Number.isInteger(packageId) || packageId < 1 || !Number.isInteger(customerId) || customerId < 1) {
    return { error: "Selecciona un paquete y un cliente válidos." };
  }
  try {
    const result = await paquetesAsignar(packageId, customerId);
    if (result.error) return { error: errorMessage(result.error.code, "No se pudo asignar el paquete.") };
    revalidatePath("/paquetes");
    revalidatePath("/cupones");
    revalidatePath("/hojas");
    return { ok: true, coupons: result.data?.cupones_generados ?? 0 };
  } catch {
    return { error: "No se pudo asignar el paquete." };
  }
}
