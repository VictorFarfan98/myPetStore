import "server-only";

import type { ServicioInsertParams, ServicioRow, ServicioUpdateParams } from "./types";
import { rpcCall } from "./core";

export function serviciosInsertar(params: ServicioInsertParams) {
  return rpcCall<ServicioRow>("servicios_insertar", params);
}

export function serviciosObtenerPorId(p_id: number) {
  return rpcCall<ServicioRow>("servicios_obtener_por_id", { p_id });
}

export function serviciosListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: ServicioRow[]; total: number; limite: number | null; offset: number }>(
    "servicios_listar",
    { p_limite, p_offset }
  );
}

export function serviciosListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: ServicioRow[]; total: number; limite: number | null; offset: number }>(
    "servicios_listar_todos",
    { p_limite, p_offset }
  );
}

export function serviciosActualizar(params: ServicioUpdateParams) {
  return rpcCall<ServicioRow>("servicios_actualizar", params);
}

export function serviciosEliminar(p_id: number) {
  return rpcCall<ServicioRow>("servicios_eliminar", { p_id });
}

