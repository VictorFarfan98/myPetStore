"use server";

import { revalidatePath } from "next/cache";
import { metodosPagoActualizar, metodosPagoEliminar, metodosPagoInsertar } from "@/lib/rpc/metodos_pago";

function validate(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Ingresa un nombre para el método de pago.");
  return { p_nombre: nombre, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function errorMessage(code?: string) {
  if (code === "PC001") return "El método de pago ya existe o está siendo usado por cupones.";
  if (code === "PV001") return "Los datos del método de pago no son válidos.";
  return "No se pudo guardar el método de pago.";
}

export async function createMetodoPago(formData: FormData) {
  try {
    const result = await metodosPagoInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el método de pago." };
  }
}

export async function updateMetodoPago(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id < 1) return { error: "El método de pago seleccionado no es válido." };
    const result = await metodosPagoActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el método de pago." };
  }
}

export async function deleteMetodoPago(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "El método de pago seleccionado no es válido." };
  const result = await metodosPagoEliminar(id);
  if (result.error) return { error: errorMessage(result.error.code) };
  revalidatePath("/configuracion");
  return { ok: true };
}
