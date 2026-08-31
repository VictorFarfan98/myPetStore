"use server";

import { revalidatePath } from "next/cache";
import {
  registrosServicioActualizar,
  registrosServicioAdicionalesReemplazar,
  registrosServicioFotosAgregar,
  registrosServicioPromocionAplicar,
  registrosServicioEliminar,
  registrosServicioIniciar
} from "@/lib/rpc/registros_servicio";
import { pagosReemplazarLista } from "@/lib/rpc/pagos";

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

function photoPaths(formData: FormData, field: "foto_ingreso_path" | "foto_egreso_path", appointmentId: number) {
  const moment = field === "foto_ingreso_path" ? "ingreso" : "egreso";
  const prefix = `services/${appointmentId}/${moment}/`;
  const paths = formData.getAll(field).map((value) => String(value).trim());
  if (paths.some((path) => !path.startsWith(prefix) || path.length === prefix.length)) {
    throw new Error("Las rutas de las fotos no son válidas.");
  }
  return paths;
}

function values(formData: FormData) {
  const citaId = id(formData, "cita_id");
  const recordId = id(formData, "registro_id");
  const servicioId = id(formData, "servicio_id");
  const peluqueroId = id(formData, "peluquero_id");
  const tamanoId = id(formData, "tamano_id");
  const firma = text(formData, "firma_ingreso_url");
  const couponId = text(formData, "cupon_id") || null;
  const discount = Number(text(formData, "descuento_cupon") || "0");
  const adicionales = formData.getAll("adicional_id").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0).map((servicio_id) => ({ servicio_id, cantidad: 1 }));
  const adicionalesConfigurados = formData.get("adicionales_configurados") === "true";
  if ((!citaId && !recordId) || !servicioId || !peluqueroId || !tamanoId || !firma) {
    throw new Error("Completa servicio, groomer, tamaño y firma de ingreso.");
  }
  const flag = (name: string) => formData.get(name) === "on";
  return {
    citaId, recordId, p_servicio_id: servicioId, p_peluquero_id: peluqueroId, p_tamano_id: tamanoId, p_cupon_id: couponId,
    p_descuento_cupon: Number.isFinite(discount) && discount >= 0 ? discount.toFixed(2) : "0",
    adicionales,
    adicionalesConfigurados,
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
    const intakePhotoPaths = photoPaths(formData, "foto_ingreso_path", appointmentId);
    const completionPhotoPaths = photoPaths(formData, "foto_egreso_path", appointmentId);
    if (input.recordId && input.adicionalesConfigurados) {
      const extras = await registrosServicioAdicionalesReemplazar({ p_registro_servicio_id: input.recordId, p_adicionales: input.adicionales });
      if (extras.error) return { error: errorMessage(extras.error) };
    }
    if (input.recordId) {
      const promo = await registrosServicioPromocionAplicar(input.recordId, formData.get("usar_promocion") === "on");
      if (promo.error) return { error: errorMessage(promo.error) };
    }
    console.log("saveHoja input", input);
    const result = input.recordId
      ? await registrosServicioActualizar({
          p_id: input.recordId,
          p_servicio_id: input.p_servicio_id,
          p_peluquero_id: input.p_peluquero_id,
          p_tamano_id: input.p_tamano_id,
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
          p_notas_servicio: input.p_notas_servicio,
          p_calificacion_satisfaccion: null,
          p_comentario_satisfaccion: null,
          p_precio_base: null,
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
          p_notas_servicio: input.p_notas_servicio
        });
    const recordId = result.data?.id ?? input.recordId;
    if (!input.recordId && !result.error && recordId) {
      const promo = await registrosServicioPromocionAplicar(recordId, formData.get("usar_promocion") === "on");
      if (promo.error) return { error: errorMessage(promo.error) };
      const extras = await registrosServicioAdicionalesReemplazar({ p_registro_servicio_id: recordId, p_adicionales: input.adicionales });
      if (extras.error) return { error: errorMessage(extras.error) };
    }
    console.log("saveHoja RPC result", result);
    if (result.error) {
      console.log("saveHoja RPC failed", result.error);
      return { error: errorMessage(result.error) };
    }
    const photos = await registrosServicioFotosAgregar({
      p_registro_servicio_id: recordId as number,
      p_fotos_ingreso: intakePhotoPaths,
      p_fotos_egreso: completionPhotoPaths
    });
    if (photos.error) return { error: errorMessage(photos.error) };
    if (input.p_firma_entrega_url && recordId && Number(result.data?.monto_final) === 0) {
      const payment = await pagosReemplazarLista({ p_registro_servicio_id: recordId, p_pagos: [], p_motivo: null });
      if (payment.error) return { error: "No se pudo completar automáticamente la hoja de servicio." };
    }
    revalidatePath("/hojas");
    revalidatePath("/agenda");
    return { ok: true, completed: Boolean(input.p_firma_entrega_url), recordId: recordId ?? 0, groomerId: input.p_peluquero_id };
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
