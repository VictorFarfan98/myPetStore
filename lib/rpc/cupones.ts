import "server-only";

import type { CuponInsertParams, CuponRow, CuponUpdateParams } from "./types";
import { rpcCall } from "./core";

export function cuponesInsertar(params: CuponInsertParams) {
  return rpcCall<CuponRow>("cupones_insertar", params);
}

export function cuponesObtenerPorId(p_id: string) {
  return rpcCall<CuponRow>("cupones_obtener_por_id", { p_id });
}

export function cuponesListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: CuponRow[]; total: number; limite: number | null; offset: number }>(
    "cupones_listar",
    { p_limite, p_offset }
  );
}

export function cuponesListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: CuponRow[]; total: number; limite: number | null; offset: number }>(
    "cupones_listar_todos",
    { p_limite, p_offset }
  );
}

export function cuponesActualizar(params: CuponUpdateParams) {
  return rpcCall<CuponRow>("cupones_actualizar", params);
}

export function cuponesEliminar(p_id: string) {
  return rpcCall<CuponRow>("cupones_eliminar", { p_id });
}

export function cuponesListarPorCliente(p_cliente_id: number) {
  return rpcCall<Record<string, unknown>[]>("cupones_listar_por_cliente", { p_cliente_id });
}

