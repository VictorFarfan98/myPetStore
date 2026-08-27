import "server-only";

import type { TamanoInsertParams, TamanoRow, TamanoUpdateParams } from "./types";
import { rpcCall } from "./core";

export function tamanosInsertar(params: TamanoInsertParams) {
  return rpcCall<TamanoRow>("tamanos_insertar", params);
}

export function tamanosObtenerPorId(p_id: number) {
  return rpcCall<TamanoRow>("tamanos_obtener_por_id", { p_id });
}

export function tamanosListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: TamanoRow[]; total: number; limite: number | null; offset: number }>(
    "tamanos_listar",
    { p_limite, p_offset }
  );
}

export function tamanosListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: TamanoRow[]; total: number; limite: number | null; offset: number }>(
    "tamanos_listar_todos",
    { p_limite, p_offset }
  );
}

export function tamanosActualizar(params: TamanoUpdateParams) {
  return rpcCall<TamanoRow>("tamanos_actualizar", params);
}

export function tamanosEliminar(p_id: number) {
  return rpcCall<TamanoRow>("tamanos_eliminar", { p_id });
}
