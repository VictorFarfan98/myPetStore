"use server";

import { revalidatePath } from "next/cache";
import { opcionesShampooActualizar, opcionesShampooEliminar, opcionesShampooInsertar } from "@/lib/rpc/opciones_shampoo";

function validate(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Ingresa un nombre para la opción de shampoo.");
  return { p_nombre: nombre, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe una opción de shampoo con ese nombre.";
  if (code === "PV001") return "Los datos de la opción de shampoo no son válidos.";
  return "No se pudo guardar la opción de shampoo.";
}

export async function createOpcionShampoo(formData: FormData) {
  try {
    const result = await opcionesShampooInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la opción de shampoo." };
  }
}

export async function updateOpcionShampoo(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id < 1) return { error: "La opción de shampoo seleccionada no es válida." };
    const result = await opcionesShampooActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la opción de shampoo." };
  }
}

export async function deleteOpcionShampoo(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "La opción de shampoo seleccionada no es válida." };
  const result = await opcionesShampooEliminar(id);
  if (result.error) return { error: "No se pudo desactivar la opción de shampoo." };
  revalidatePath("/servicios");
  return { ok: true };
}
