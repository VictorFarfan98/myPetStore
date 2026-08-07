"use server";

import { revalidatePath } from "next/cache";
import { createUserSupabaseClient } from "@/lib/supabase/server";
import {
  registrosServicioActualizar,
  registrosServicioEliminar,
  registrosServicioIniciar
} from "@/lib/rpc/registros_servicio";

const conditionFields = [
  ["heridas_visibles", "Heridas visibles"],
  ["raspones", "Raspones"],
  ["piel_irritada", "Piel irritada / enrojecida"],
  ["costras", "Costras"],
  ["inflamacion", "Inflamacion"],
  ["cojera", "Cojera"],
  ["dolor_al_tocar", "Dolor al tocar"]
] as const;
const parasiteFields = [["pulgas", "Pulgas"], ["garrapatas", "Garrapatas"], ["piojos", "Piojos"]] as const;

function id(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function uploadPhoto(formData: FormData, field: "foto_antes" | "foto_despues", appointmentId: number, currentPath: string | null) {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return currentPath;
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
    throw new Error("La foto debe ser una imagen de máximo 10 MB.");
  }

  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const prefix = field === "foto_antes" ? "before" : "after";
  const path = `services/${appointmentId}/${prefix}-${crypto.randomUUID()}.${extension}`;
  const supabase = await createUserSupabaseClient();
  const { error } = await supabase.storage.from("petstore").upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false
  });
  if (error) {
    console.error("uploadPhoto failed", { field, message: error.message });
    throw new Error("No se pudo subir la foto.");
  }
  return path;
}

function values(formData: FormData) {
  const citaId = id(formData, "cita_id");
  const recordId = id(formData, "registro_id");
  const servicioId = id(formData, "servicio_id");
  const peluqueroId = id(formData, "peluquero_id");
  const tamanoId = id(formData, "tamano_id");
  const shampooId = id(formData, "shampoo_id");
  const firma = text(formData, "firma_ingreso_url");
  const couponId = text(formData, "cupon_id") || null;
  const discount = Number(text(formData, "descuento_cupon") || "0");
  if ((!citaId && !recordId) || !servicioId || !peluqueroId || !tamanoId || !firma) {
    throw new Error("Completa servicio, groomer, tamaño y firma de ingreso.");
  }
  if ((servicioId === 1 || servicioId === 3) && !shampooId) throw new Error("Selecciona una opción de shampoo para este servicio.");

  const flag = (name: string) => formData.get(name) === "on";
  return {
    citaId, recordId, p_servicio_id: servicioId, p_peluquero_id: peluqueroId, p_tamano_id: tamanoId, p_shampoo_id: servicioId === 1 || servicioId === 3 ? shampooId : null, p_cupon_id: couponId,
    p_descuento_cupon: Number.isFinite(discount) && discount >= 0 ? discount.toFixed(2) : "0",
    p_firma_ingreso_url: firma,
    p_firma_entrega_url: text(formData, "firma_entrega_url") || null,
    p_notas_servicio: text(formData, "notas_servicio") || null,
    p_observaciones_ingreso: text(formData, "observaciones_ingreso") || null,
    p_heridas_visibles: flag("heridas_visibles"), p_raspones: flag("raspones"),
    p_piel_irritada: flag("piel_irritada"), p_costras: flag("costras"),
    p_inflamacion: flag("inflamacion"), p_cojera: flag("cojera"),
    p_dolor_al_tocar: flag("dolor_al_tocar"), p_pulgas: flag("pulgas"),
    p_garrapatas: flag("garrapatas"), p_piojos: flag("piojos")
  };
}

function errorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === "PA001") return "No tienes permiso para editar esta hoja.";
  if (error?.code === "PN001") return "La hoja o la cita no existe.";
  if (error?.code === "PC001") return "La cita ya tiene una hoja de servicio.";
  console.log("Error en RPC de registros_servicio", { code: error?.code, message: error?.message });
  return "No se pudo guardar la hoja de servicio.";
}

export async function saveHoja(formData: FormData) {
  try {
    const input = values(formData);
    const appointmentId = input.citaId ?? input.recordId!;
    const beforePhotoUrl = await uploadPhoto(formData, "foto_antes", appointmentId, text(formData, "foto_antes_url_actual") || null);
    const afterPhotoUrl = await uploadPhoto(formData, "foto_despues", appointmentId, text(formData, "foto_despues_url_actual") || null);
    console.log("saveHoja input", { ...input, p_foto_antes_url: beforePhotoUrl });
    const result = input.recordId
      ? await registrosServicioActualizar({
          p_id: input.recordId,
          p_servicio_id: input.p_servicio_id,
          p_peluquero_id: input.p_peluquero_id,
          p_tamano_id: input.p_tamano_id,
          p_shampoo_id: input.p_shampoo_id,
          p_cupon_id: input.p_cupon_id,
          p_heridas_visibles: input.p_heridas_visibles,
          p_raspones: input.p_raspones,
          p_piel_irritada: input.p_piel_irritada,
          p_costras: input.p_costras,
          p_inflamacion: input.p_inflamacion,
          p_cojera: input.p_cojera,
          p_dolor_al_tocar: input.p_dolor_al_tocar,
          p_pulgas: input.p_pulgas,
          p_garrapatas: input.p_garrapatas,
          p_piojos: input.p_piojos,
          p_observaciones_ingreso: input.p_observaciones_ingreso,
          p_firma_ingreso_url: input.p_firma_ingreso_url,
          p_firma_entrega_url: input.p_firma_entrega_url,
          p_foto_antes_url: beforePhotoUrl,
          p_foto_despues_url: afterPhotoUrl,
          p_notas_servicio: input.p_notas_servicio,
          p_calificacion_satisfaccion: null,
          p_comentario_satisfaccion: null,
          p_precio_base: null,
          p_recargo_shampoo: "0",
          p_descuento_cupon: input.p_descuento_cupon,
          p_monto_final: null,
          p_monto_pagado: null,
          p_activo: true
        })
      : await registrosServicioIniciar({
          p_cita_id: input.citaId as number,
          p_servicio_id: input.p_servicio_id,
          p_peluquero_id: input.p_peluquero_id,
          p_tamano_id: input.p_tamano_id,
          p_shampoo_id: input.p_shampoo_id,
          p_heridas_visibles: input.p_heridas_visibles,
          p_raspones: input.p_raspones,
          p_piel_irritada: input.p_piel_irritada,
          p_costras: input.p_costras,
          p_inflamacion: input.p_inflamacion,
          p_cojera: input.p_cojera,
          p_dolor_al_tocar: input.p_dolor_al_tocar,
          p_pulgas: input.p_pulgas,
          p_garrapatas: input.p_garrapatas,
          p_piojos: input.p_piojos,
          p_observaciones_ingreso: input.p_observaciones_ingreso,
          p_firma_ingreso_url: input.p_firma_ingreso_url,
          p_foto_antes_url: beforePhotoUrl,
          p_notas_servicio: input.p_notas_servicio
        });
    console.log("saveHoja RPC result", result);
    if (result.error) {
      console.log("saveHoja RPC failed", result.error);
      return { error: errorMessage(result.error) };
    }
    revalidatePath("/hojas");
    revalidatePath("/agenda");
    return { ok: true, completed: Boolean(input.p_firma_entrega_url), recordId: result.data?.id ?? input.recordId ?? 0, groomerId: input.p_peluquero_id };
  } catch (error) {
    console.error("saveHoja failed", error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return { error: error instanceof Error ? error.message : "No se pudo guardar la hoja de servicio." };
  }
}

export async function deleteHoja(formData: FormData) {
  const recordId = id(formData, "registro_id");
  if (!recordId) return { error: "La hoja seleccionada no es válida." };
  const result = await registrosServicioEliminar(recordId);
  if (result.error) return { error: errorMessage(result.error) };
  revalidatePath("/hojas");
  return { ok: true };
}
