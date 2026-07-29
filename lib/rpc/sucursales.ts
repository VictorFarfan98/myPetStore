import "server-only";

import type { SucursalInsertParams, SucursalRow, SucursalUpdateParams } from "./types";
import { rpcCall } from "./core";

export function sucursalesInsertar(params: SucursalInsertParams) {
  return rpcCall<SucursalRow>("sucursales_insertar", params);
}

export function sucursalesObtenerPorId(p_id: number) {
  return rpcCall<SucursalRow>("sucursales_obtener_por_id", { p_id });
}

export function sucursalesListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: SucursalRow[]; total: number; limite: number | null; offset: number }>(
    "sucursales_listar",
    { p_limite, p_offset }
  );
}

export function sucursalesListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: SucursalRow[]; total: number; limite: number | null; offset: number }>(
    "sucursales_listar_todos",
    { p_limite, p_offset }
  );
}

export function sucursalesActualizar(params: SucursalUpdateParams) {
  return rpcCall<SucursalRow>("sucursales_actualizar", params);
}

export function sucursalesEliminar(p_id: number) {
  return rpcCall<SucursalRow>("sucursales_eliminar", { p_id });
}

