"use server";

import { revalidatePath } from "next/cache";
import { tamanosActualizar, tamanosEliminar, tamanosInsertar } from "@/lib/rpc/tamanos";

function validate(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Ingresa un nombre para el tamaño.");
  return { p_nombre: nombre, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe un tamaño con ese nombre.";
  if (code === "PV001") return "Los datos del tamaño no son válidos.";
  return "No se pudo guardar el tamaño.";
}

export async function createTamano(formData: FormData) {
  try {
    const result = await tamanosInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el tamaño." };
  }
}

export async function updateTamano(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id < 1) return { error: "El tamaño seleccionado no es válido." };
    const result = await tamanosActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el tamaño." };
  }
}

export async function deleteTamano(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "El tamaño seleccionado no es válido." };
  const result = await tamanosEliminar(id);
  if (result.error) return { error: "No se pudo desactivar el tamaño." };
  revalidatePath("/servicios");
  return { ok: true };
}
