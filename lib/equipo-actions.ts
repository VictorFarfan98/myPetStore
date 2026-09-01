"use server";

import { revalidatePath } from "next/cache";
import { optionalE164 } from "@/lib/phone";
import { peluquerosActualizar, peluquerosEliminar, peluquerosInsertar, peluquerosVincularUsuario, usuariosActualizar, usuariosEliminar, usuariosInsertar } from "@/lib/rpc";

function text(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function active(formData: FormData) { return formData.get("activo") !== null && formData.get("activo") !== "false"; }
function errorMessage(code?: string, operation = "guardar") {
  if (code === "PC001") return "Ya existe un registro con esos datos.";
  if (code === "PV001") return "Los datos ingresados no son válidos.";
  if (code === "PN001") return "No se encontró el usuario de Supabase Auth. Verifica que el UUID sea exacto.";
  if (code === "PA001" || code === "42501") return `No tienes permiso para ${operation}. Verifica que tu sesión corresponda a un administrador activo.`;
  if (code === "22P02" || code === "PGRST202") return "La migración de roles todavía no está aplicada en la base de datos.";
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
  const role = text(formData, "rol");
  const worker = role === "groomer" || role === "driver";
  const scope = worker ? "sucursales_asignadas" : text(formData, "alcance") || "todas_las_sucursales";
  const branchIds = branches(formData);
  const groomerId = Number(formData.get("peluquero_id"));
  if (!(["encargado", "groomer", "driver"] as string[]).includes(role)) return { error: "Selecciona un rol válido." };
  if (worker && (!Number.isInteger(groomerId) || groomerId <= 0) && role === "groomer") return { error: "Selecciona el groomista vinculado." };
  if (worker && branchIds.length !== 1) return { error: "Selecciona una sucursal para el trabajador." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !nombre || !/^[a-z0-9._-]+$/.test(username)) return { error: "Ingresa un UUID de Auth, nombre y usuario válidos." };
  const result = await usuariosInsertar({ p_id: id, p_nombre: nombre, p_nombre_usuario: username, p_telefono: optionalE164(text(formData, "telefono")), p_rol: role, p_alcance_acceso: scope, p_activo: active(formData), p_sucursal_ids: branchIds });
  if (result.error) return { error: errorMessage(result.error.code, "crear el perfil de usuario") };
  if (role === "groomer") {
    const link = await peluquerosVincularUsuario(groomerId, id);
    if (link.error) return { error: errorMessage(link.error.code, "vincular el groomista") };
  }
  revalidatePath("/equipo");
  return { ok: true };
}

export async function updateManager(formData: FormData) {
  try {
    const userId = text(formData, "id");
    const role = text(formData, "rol");
    const worker = role === "groomer" || role === "driver";
    const branchIds = branches(formData);
    const groomerId = Number(formData.get("peluquero_id"));
    if (!["encargado", "groomer", "driver"].includes(role)) return { error: "Selecciona un rol válido." };
    if (worker && branchIds.length !== 1) return { error: "Selecciona una sucursal para el trabajador." };
    if (role === "groomer" && (!Number.isInteger(groomerId) || groomerId <= 0)) return { error: "Selecciona el groomista vinculado." };
    const result = await usuariosActualizar({ p_id: userId, p_nombre: text(formData, "nombre"), p_telefono: optionalE164(text(formData, "telefono")), p_rol: role, p_alcance_acceso: worker ? "sucursales_asignadas" : text(formData, "alcance") || "todas_las_sucursales", p_activo: active(formData), p_sucursal_ids: branchIds });
    if (result.error) return { error: errorMessage(result.error.code, "actualizar el perfil de usuario") };
    if (groomerId > 0) {
      const link = await peluquerosVincularUsuario(groomerId, role === "groomer" ? userId : null);
      if (link.error) return { error: errorMessage(link.error.code, "vincular el groomista") };
    }
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
