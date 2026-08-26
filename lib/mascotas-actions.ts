"use server";

import { revalidatePath } from "next/cache";
import { clientesInsertar } from "@/lib/rpc/clientes";
import { mascotasActualizar, mascotasEliminar, mascotasInsertar } from "@/lib/rpc/mascotas";
import { toE164 } from "@/lib/phone";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function number(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function petParams(formData: FormData, clienteId: number) {
  const nombre = text(formData, "nombre");
  const tamanoId = number(formData, "tamano_id");
  if (!nombre || !tamanoId) throw new Error("Completa el nombre y tamaño de la mascota.");

  return {
    p_cliente_id: clienteId,
    p_nombre: nombre,
    p_especie: (text(formData, "especie") || "otro") as "perro" | "gato" | "otro",
    p_raza: text(formData, "raza"),
    p_tamano_id: tamanoId,
    p_foto_perfil_url: text(formData, "foto_perfil_url") || null,
    p_fecha_nacimiento: text(formData, "fecha_nacimiento") || null,
    p_notas_salud: text(formData, "notas_salud") || null,
    p_notas_comportamiento: text(formData, "notas_comportamiento") || null,
    p_intervalo_preferido_dias: number(formData, "intervalo_preferido_dias"),
    p_activo: true
  };
}

function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe una mascota con esos datos.";
  if (code === "PV001") return "Los datos de la mascota no son válidos.";
  return "No se pudo guardar la mascota.";
}

async function clienteId(formData: FormData) {
  const existingId = number(formData, "cliente_id");
  if (existingId) return existingId;

  const nombre = text(formData, "cliente_nombre");
  const telefono = text(formData, "cliente_telefono");
  const email = text(formData, "cliente_email");
  if (!nombre || !telefono) throw new Error("Completa el nombre y teléfono del nuevo cliente.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo electrónico no es válido.");

  const result = await clientesInsertar({
    p_nombre: nombre,
    p_telefono: toE164(telefono),
    p_email: email.toLowerCase() || null,
    p_whatsapp_opt_in: formData.get("cliente_whatsapp_opt_in") === "on",
    p_sms_opt_in: formData.get("cliente_sms_opt_in") === "on",
    p_notas: text(formData, "cliente_notas") || null,
    p_activo: true
  });
  if (result.error) throw Object.assign(new Error("No se pudo crear el cliente."), { code: result.error.code });
  return result.data?.id ?? null;
}

export async function createMascota(formData: FormData) {
  try {
    const id = await clienteId(formData);
    if (!id) return { error: "No se pudo identificar el cliente." };
    const result = await mascotasInsertar(petParams(formData, id));
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/mascotas");
    revalidatePath("/clientes");
    return { ok: true };
  } catch (error) {
    const typed = error as Error & { code?: string };
    return { error: typed.code === "PC001" ? "Ya existe un cliente con esos datos." : typed.message || "No se pudo crear la mascota." };
  }
}

export async function updateMascota(formData: FormData) {
  const id = number(formData, "id");
  const clienteIdValue = number(formData, "cliente_id");
  if (!id || !clienteIdValue) return { error: "La mascota o cliente seleccionado no es válido." };
  try {
    const result = await mascotasActualizar({ p_id: id, ...petParams(formData, clienteIdValue) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/mascotas");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la mascota." };
  }
}

export async function deleteMascota(formData: FormData) {
  const id = number(formData, "id");
  if (!id) return { error: "La mascota seleccionada no es válida." };
  const result = await mascotasEliminar(id);
  if (result.error) return { error: "No se pudo desactivar la mascota." };
  revalidatePath("/mascotas");
  return { ok: true };
}
