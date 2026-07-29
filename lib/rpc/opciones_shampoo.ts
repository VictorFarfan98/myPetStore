import "server-only";

import type { OpcionShampooInsertParams, OpcionShampooRow, OpcionShampooUpdateParams } from "./types";
import { rpcCall } from "./core";

export function opcionesShampooInsertar(params: OpcionShampooInsertParams) {
  return rpcCall<OpcionShampooRow>("opciones_shampoo_insertar", params);
}

export function opcionesShampooObtenerPorId(p_id: number) {
  return rpcCall<OpcionShampooRow>("opciones_shampoo_obtener_por_id", { p_id });
}

export function opcionesShampooListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: OpcionShampooRow[]; total: number; limite: number | null; offset: number }>(
    "opciones_shampoo_listar",
    { p_limite, p_offset }
  );
}

export function opcionesShampooListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: OpcionShampooRow[]; total: number; limite: number | null; offset: number }>(
    "opciones_shampoo_listar_todos",
    { p_limite, p_offset }
  );
}

export function opcionesShampooActualizar(params: OpcionShampooUpdateParams) {
  return rpcCall<OpcionShampooRow>("opciones_shampoo_actualizar", params);
}

export function opcionesShampooEliminar(p_id: number) {
  return rpcCall<OpcionShampooRow>("opciones_shampoo_eliminar", { p_id });
}

