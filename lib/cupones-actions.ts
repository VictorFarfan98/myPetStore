"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cuponesActualizar, cuponesEliminar, cuponesInsertar } from "@/lib/rpc/cupones";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalId(formData: FormData, name: string) {
  const value = text(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error("Selecciona datos válidos para el cupón.");
  return parsed;
}

function validate(formData: FormData) {
  const nombre = text(formData, "nombre");
  const tipo = text(formData, "tipo_descuento");
  const valor = text(formData, "valor");
  const fecha = text(formData, "fecha_expiracion");
  const numericValue = Number(valor);
  if (!nombre || !["monto_fijo", "porcentaje"].includes(tipo) || !/^\d+(?:\.\d{1,2})?$/.test(valor) || numericValue <= 0 || (tipo === "porcentaje" && numericValue > 100)) {
    throw new Error("Ingresa un nombre y descuento válidos.");
  }
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha de expiración no es válida.");

  return {
    p_nombre: nombre,
    p_cliente_id: optionalId(formData, "cliente_id"),
    p_servicio_id: optionalId(formData, "servicio_id"),
    p_tipo_descuento: tipo,
    p_valor: numericValue.toFixed(2),
    p_fecha_expiracion: fecha || null,
    p_uso_unico: formData.get("uso_unico") === "on",
    p_activo: formData.get("activo") === "on"
  };
}

function errorMessage(code?: string) {
  if (code === "PE001") return "El cupón ya fue utilizado y no puede modificarse.";
  if (code === "PV001") return "Los datos del cupón no son válidos.";
  if (code === "PN001") return "El cupón no existe.";
  return "No se pudo guardar el cupón.";
}

export async function createCupon(formData: FormData) {
  try {
    const result = await cuponesInsertar({ p_id: randomUUID(), ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/cupones");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el cupón." };
  }
}

export async function updateCupon(formData: FormData) {
  const couponId = text(formData, "id");
  if (!couponId) return { error: "El cupón seleccionado no es válido." };
  try {
    const result = await cuponesActualizar({ p_id: couponId, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    revalidatePath("/cupones");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el cupón." };
  }
}

export async function deleteCupon(formData: FormData) {
  const couponId = text(formData, "id");
  if (!couponId) return { error: "El cupón seleccionado no es válido." };
  const result = await cuponesEliminar(couponId);
  if (result.error) return { error: "No se pudo desactivar el cupón." };
  revalidatePath("/cupones");
  return { ok: true };
}
