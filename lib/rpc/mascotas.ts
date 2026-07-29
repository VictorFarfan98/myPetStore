import "server-only";

import type { MascotaInsertParams, MascotaRow, MascotaUpdateParams } from "./types";
import { rpcCall } from "./core";

export function mascotasInsertar(params: MascotaInsertParams) {
  return rpcCall<MascotaRow>("mascotas_insertar", params);
}

export function mascotasObtenerPorId(p_id: number) {
  return rpcCall<MascotaRow>("mascotas_obtener_por_id", { p_id });
}

export function mascotasListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: MascotaRow[]; total: number; limite: number | null; offset: number }>(
    "mascotas_listar",
    { p_limite, p_offset }
  );
}

export function mascotasListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: MascotaRow[]; total: number; limite: number | null; offset: number }>(
    "mascotas_listar_todos",
    { p_limite, p_offset }
  );
}

export function mascotasActualizar(params: MascotaUpdateParams) {
  return rpcCall<MascotaRow>("mascotas_actualizar", params);
}

export function mascotasEliminar(p_id: number) {
  return rpcCall<MascotaRow>("mascotas_eliminar", { p_id });
}

