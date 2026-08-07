"use server";

import { revalidatePath } from "next/cache";
import { opcionesShampooActualizar, opcionesShampooEliminar, opcionesShampooInsertar } from "@/lib/rpc/opciones_shampoo";
import { preciosShampooActualizar, preciosShampooInsertar, preciosShampooObtenerPorId } from "@/lib/rpc/precios_shampoo";

function validate(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("Ingresa un nombre para la opción de shampoo.");
  return { p_nombre: nombre, p_activo: formData.get("activo") !== null && formData.get("activo") !== "false" };
}

function prices(formData: FormData) {
  return [...formData.entries()]
    .filter(([name]) => name.startsWith("recargo_"))
    .map(([name, value]) => {
      const tamanoId = Number(name.slice("recargo_".length));
      const recargo = String(value).trim();
      if (!Number.isInteger(tamanoId) || tamanoId < 1 || !/^(?:\d+)(?:\.\d{1,2})?$/.test(recargo)) throw new Error("Ingresa recargos de shampoo válidos para cada tamaño.");
      return { tamanoId, recargo };
    });
}

async function savePrices(shampooId: number, formData: FormData) {
  const activo = formData.get("activo") !== null && formData.get("activo") !== "false";
  for (const { tamanoId, recargo } of prices(formData)) {
    const existing = await preciosShampooObtenerPorId(shampooId, tamanoId);
    const result = existing.data
      ? await preciosShampooActualizar({ p_shampoo_id: shampooId, p_tamano_id: tamanoId, p_recargo: recargo, p_activo: activo })
      : await preciosShampooInsertar({ p_shampoo_id: shampooId, p_tamano_id: tamanoId, p_recargo: recargo, p_activo: activo });
    if (result.error) throw new Error("No se pudieron guardar los recargos de shampoo.");
  }
}

function errorMessage(code?: string) {
  if (code === "PC001") return "Ya existe una opción de shampoo con ese nombre.";
  if (code === "PV001") return "Los datos de la opción de shampoo no son válidos.";
  return "No se pudo guardar la opción de shampoo.";
}

export async function createOpcionShampoo(formData: FormData) {
  try {
    const result = await opcionesShampooInsertar(validate(formData));
    if (result.error) return { error: errorMessage(result.error.code) };
    if (!result.data) return { error: "No se pudo crear la opción de shampoo." };
    await savePrices(result.data.id, formData);
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la opción de shampoo." };
  }
}

export async function updateOpcionShampoo(formData: FormData) {
  try {
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id < 1) return { error: "La opción de shampoo seleccionada no es válida." };
    const result = await opcionesShampooActualizar({ p_id: id, ...validate(formData) });
    if (result.error) return { error: errorMessage(result.error.code) };
    await savePrices(id, formData);
    revalidatePath("/servicios");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la opción de shampoo." };
  }
}

export async function deleteOpcionShampoo(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return { error: "La opción de shampoo seleccionada no es válida." };
  const result = await opcionesShampooEliminar(id);
  if (result.error) return { error: "No se pudo desactivar la opción de shampoo." };
  revalidatePath("/servicios");
  return { ok: true };
}
