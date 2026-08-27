"use server";

import { revalidatePath } from "next/cache";
import { clientesActualizar, clientesBuscarListar, clientesEliminar, clientesInsertar, clientesListar, clientesProgresoFidelidadListar } from "@/lib/rpc/clientes";
import { unwrapRpcResult } from "@/lib/rpc/core";
import type { ClientesData } from "@/lib/types";
import { toE164 } from "@/lib/phone";
import { createUserSupabaseClient } from "@/lib/supabase/server";

export async function getClientes(page = 1, pageSize = 20, query = ""): Promise<ClientesData> {
  const offset = (page - 1) * pageSize;
  const normalizedQuery = query.trim().slice(0, 100);
  const [clientesResult, progresoResult] = await Promise.all([
    normalizedQuery ? clientesBuscarListar(normalizedQuery, pageSize, offset) : clientesListar(pageSize, offset),
    clientesProgresoFidelidadListar()
  ]);
  const clientes = unwrapRpcResult(clientesResult).datos;
  const customerIds = clientes.map((cliente) => cliente.id);
  const supabase = await createUserSupabaseClient();
  const mascotasResult = customerIds.length
    ? await supabase.from("mascotas").select("id, cliente_id, nombre, raza").in("cliente_id", customerIds).eq("activo", true)
    : { data: [], error: null };
  if (mascotasResult.error) throw new Error("No se pudieron cargar las mascotas de los clientes.");
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
    pets: (mascotasResult.data ?? []).map((mascota) => ({
      id: mascota.id,
      customerId: mascota.cliente_id,
      name: mascota.nombre,
      breed: String(mascota.raza ?? "").trim()
    })),
    total: unwrapRpcResult(clientesResult).total,
    pageSize
  };
}

export async function searchClientes(query: string) {
  const normalizedQuery = query.trim().slice(0, 100);
  if (normalizedQuery.length < 2) return { customers: [] };
  const result = await clientesBuscarListar(normalizedQuery, 20, 0);
  if (result.error) return { error: "No se pudieron buscar clientes." };
  return { customers: (result.data?.datos ?? []).map((customer) => ({ id: customer.id, name: customer.nombre, phone: customer.telefono })) };
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
