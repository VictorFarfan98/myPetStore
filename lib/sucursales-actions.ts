"use server";

import { revalidatePath } from "next/cache";
import { sucursalesActualizar, sucursalesEliminar, sucursalesInsertar } from "@/lib/rpc/sucursales";
import { toE164 } from "@/lib/phone";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validate(formData: FormData) {
  const nombre = text(formData, "nombre");
  const direccion = text(formData, "direccion");
  const telefono = toE164(text(formData, "telefono"));
  if (!nombre || !direccion) throw new Error("Completa todos los campos de la sucursal.");
  return { p_nombre: nombre, p_direccion: direccion, p_telefono: telefono, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function errorMessage(error: { code?: string; message?: string }) {
  if (error.code === "PC001") return "Ya existe una sucursal con esos datos.";
  if (error.code === "PV001") return "Los datos de la sucursal no son válidos.";
  return "No se pudo guardar la sucursal.";
}

export async function createSucursal(formData: FormData) {
  try {
    const result = await sucursalesInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error) };
    revalidatePath("/sucursales");
    return { ok: true };
  } catch { return { error: "Completa todos los campos de la sucursal." }; }
}

export async function updateSucursal(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id < 1) return { error: "La sucursal seleccionada no es válida." };
    const result = await sucursalesActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error) };
    revalidatePath("/sucursales");
    return { ok: true };
  } catch { return { error: "No se pudo actualizar la sucursal." }; }
}

export async function deleteSucursal(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "La sucursal seleccionada no es válida." };
  const result = await sucursalesEliminar(id);
  if (result.error) return { error: "No se pudo eliminar la sucursal." };
  revalidatePath("/sucursales");
  return { ok: true };
}
