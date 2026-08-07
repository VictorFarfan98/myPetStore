"use server";

import { calificacionesGroomerInsertar } from "@/lib/rpc/calificaciones_groomer";

export async function saveCalificacionGroomer(formData: FormData) {
  const recordId = Number(formData.get("registro_servicio_id"));
  const rating = Number(formData.get("calificacion"));
  const notes = String(formData.get("calificacion_notas") ?? "").trim();
  if (!Number.isInteger(recordId) || recordId < 1 || !Number.isInteger(rating) || rating < 0 || rating > 5) {
    return { error: "Selecciona una calificación válida." };
  }

  const result = await calificacionesGroomerInsertar({
    p_registro_servicio_id: recordId,
    p_calificacion: rating,
    p_calificacion_notas: notes || null
  });
  if (result.error) {
    console.error("Error al guardar calificación del groomer", { code: result.error.code, message: result.error.message });
    if (result.error.code === "PC001") return { error: "Esta hoja ya tiene una calificación." };
    if (result.error.code === "PV001") return { error: "La calificación no es válida o está deshabilitada." };
    return { error: "No se pudo guardar la calificación." };
  }
  return { ok: true };
}
