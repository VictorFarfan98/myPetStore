"use server";

import { revalidatePath } from "next/cache";
import { tamanosActualizar, tamanosEliminar, tamanosInsertar } from "@/lib/rpc/tamanos";

function validate(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const especie = String(formData.get("especie") ?? "");
  if (!nombre || !["perro", "gato", "otro"].includes(especie)) throw new Error("Ingresa una especie y un nombre válidos para la clasificación.");
  return { p_especie: especie as "perro" | "gato" | "otro", p_nombre: nombre, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe una clasificación con ese nombre para la especie seleccionada.";
  if (code === "PV001") return "Los datos de la clasificación no son válidos.";
  return "No se pudo guardar la clasificación.";
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
