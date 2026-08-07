"use server";

import { revalidatePath } from "next/cache";
import { optionalE164 } from "@/lib/phone";
import { peluquerosActualizar, peluquerosEliminar, peluquerosInsertar, usuariosActualizar, usuariosEliminar, usuariosInsertar } from "@/lib/rpc";

function text(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function active(formData: FormData) { return formData.get("activo") !== null && formData.get("activo") !== "false"; }
function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe un registro con esos datos.";
  if (code === "PV001") return "Los datos ingresados no son válidos.";
  return "No se pudo guardar el registro.";
}
function branches(formData: FormData) { return formData.getAll("sucursal_id").map(Number).filter((id) => Number.isInteger(id) && id > 0); }

export async function createGroomer(formData: FormData) {
  try {
    const result = await peluquerosInsertar({ p_nombre: text(formData, "nombre"), p_telefono: optionalE164(text(formData, "telefono")), p_color_calendario: text(formData, "color") || "#FFFF00", p_activo: active(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/equipo");
    return { ok: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo crear el groomista." }; }
}

export async function updateGroomer(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    const result = await peluquerosActualizar({ p_id: id, p_nombre: text(formData, "nombre"), p_telefono: optionalE164(text(formData, "telefono")), p_color_calendario: text(formData, "color") || "#FFFF00", p_activo: active(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/equipo");
    return { ok: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el groomista." }; }
}

export async function deleteGroomer(formData: FormData) {
  const result = await peluquerosEliminar(Number(formData.get("id")));
  if (result.error) return { error: "No se pudo desactivar el groomista." };
  revalidatePath("/equipo");
  return { ok: true };
}

export async function createManager(formData: FormData) {
  const id = text(formData, "id");
  const username = text(formData, "nombre_usuario").toLowerCase();
  const nombre = text(formData, "nombre");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !nombre || !/^[a-z0-9._-]+$/.test(username)) return { error: "Ingresa un UUID de Auth, nombre y usuario válidos." };
  const result = await usuariosInsertar({ p_id: id, p_nombre: nombre, p_nombre_usuario: username, p_telefono: optionalE164(text(formData, "telefono")), p_rol: "encargado", p_alcance_acceso: text(formData, "alcance") || "todas_las_sucursales", p_activo: active(formData), p_sucursal_ids: branches(formData) });
  if (result.error) return { error: errorMessage(result.error.code) };
  revalidatePath("/equipo");
  return { ok: true };
}

export async function updateManager(formData: FormData) {
  try {
    const result = await usuariosActualizar({ p_id: text(formData, "id"), p_nombre: text(formData, "nombre"), p_telefono: optionalE164(text(formData, "telefono")), p_rol: "encargado", p_alcance_acceso: text(formData, "alcance") || "todas_las_sucursales", p_activo: active(formData), p_sucursal_ids: branches(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/equipo");
    return { ok: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el encargado." }; }
}

export async function deleteManager(formData: FormData) {
  const result = await usuariosEliminar(text(formData, "id"));
  if (result.error) return { error: "No se pudo desactivar el encargado." };
  revalidatePath("/equipo");
  return { ok: true };
}
