"use server";

import { revalidatePath } from "next/cache";
import { configuracionSistemaActualizar } from "@/lib/rpc/configuracion_sistema";

export async function updateConfiguracionSistema(formData: FormData) {
  const dias = Number(formData.get("dias_anticipacion_recordatorio"));
  const metodoPagoId = Number(formData.get("metodo_pago_cupon_id"));
  if (!Number.isInteger(dias) || dias < 1 || !Number.isInteger(metodoPagoId) || metodoPagoId < 1) {
    return { error: "Ingresa días y método de pago válidos." };
  }

  const result = await configuracionSistemaActualizar({
    p_foto_antes_requerida: formData.get("foto_antes_requerida") === "on",
    p_foto_despues_requerida: formData.get("foto_despues_requerida") === "on",
    p_dias_anticipacion_recordatorio: dias,
    p_metodo_pago_cupon_id: metodoPagoId,
    p_habilitar_calificaciones: formData.get("habilitar_calificaciones") === "on"
  });

  if (result.error) {
    console.error("Error al actualizar configuración del sistema", { code: result.error.code, message: result.error.message });
    return { error: result.error.code === "PV001" ? "Los datos de configuración no son válidos." : "No se pudo guardar la configuración." };
  }

  revalidatePath("/configuracion");
  return { ok: true };
}
