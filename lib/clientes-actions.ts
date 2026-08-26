"use server";

import { revalidatePath } from "next/cache";
import { clientesActualizar, clientesEliminar, clientesInsertar, clientesListar, clientesProgresoFidelidadListar } from "@/lib/rpc/clientes";
import { mascotasListar } from "@/lib/rpc/mascotas";
import { unwrapRpcResult } from "@/lib/rpc/core";
import type { ClientesData } from "@/lib/types";
import { toE164 } from "@/lib/phone";

export async function getClientes(): Promise<ClientesData> {
  const [clientesResult, mascotasResult, progresoResult] = await Promise.all([
    clientesListar(),
    mascotasListar(),
    clientesProgresoFidelidadListar()
  ]);
  const clientes = unwrapRpcResult(clientesResult).datos;
  const mascotas = mascotasResult.error ? [] : unwrapRpcResult(mascotasResult).datos;
  const progreso = new Map(unwrapRpcResult(progresoResult).map((row) => [row.cliente_id, row]));

  return {
    customers: clientes.filter((cliente) => cliente.activo).map((cliente) => {
      const loyalty = progreso.get(cliente.id);
      return {
        id: cliente.id,
        name: cliente.nombre,
        phone: cliente.telefono,
        email: cliente.email?.trim() ?? "",
        whatsappOptIn: cliente.whatsapp_opt_in,
        smsOptIn: cliente.sms_opt_in,
        notes: cliente.notas?.trim() ?? "",
        loyaltyProgress: loyalty?.completados ?? 0,
        loyaltyRequired: loyalty?.requeridos ?? 5
      };
    }),
    pets: mascotas.filter((mascota) => mascota.activo).map((mascota) => ({
      id: mascota.id,
      customerId: mascota.cliente_id,
      name: mascota.nombre,
      breed: mascota.raza?.trim() ?? ""
    }))
  };
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function active(formData: FormData) {
  return formData.get("activo") !== "false";
}

function validate(formData: FormData) {
  const nombre = text(formData, "nombre");
  if (!nombre) throw new Error("El nombre del cliente es obligatorio.");
  const email = text(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo electrónico no es válido.");

  return {
    p_nombre: nombre,
    p_telefono: toE164(text(formData, "telefono")),
    p_email: email.toLowerCase() || null,
    p_whatsapp_opt_in: formData.get("whatsapp_opt_in") === "on",
    p_sms_opt_in: formData.get("sms_opt_in") === "on",
    p_notas: text(formData, "notas") || null,
    p_activo: active(formData)
  };
}

function errorMessage(error: { code?: string }) {
  if (error.code === "PC001") return "Ya existe un cliente con esos datos.";
  if (error.code === "PV001") return "Los datos del cliente no son válidos.";
  return "No se pudo guardar el cliente.";
}

export async function createCliente(formData: FormData) {
  try {
    const result = await clientesInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error) };
    revalidatePath("/clientes");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el cliente." };
  }
}

export async function updateCliente(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "El cliente seleccionado no es válido." };

  try {
    const result = await clientesActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error) };
    revalidatePath("/clientes");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el cliente." };
  }
}

export async function deleteCliente(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "El cliente seleccionado no es válido." };

  const result = await clientesEliminar(id);
  if (result.error) return { error: "No se pudo desactivar el cliente." };
  revalidatePath("/clientes");
  return { ok: true };
}
