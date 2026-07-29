import "server-only";

import type { MetodoPagoInsertParams, MetodoPagoRow, MetodoPagoUpdateParams } from "./types";
import { rpcCall } from "./core";

export function metodosPagoInsertar(params: MetodoPagoInsertParams) {
  return rpcCall<MetodoPagoRow>("metodos_pago_insertar", params);
}

export function metodosPagoObtenerPorId(p_id: number) {
  return rpcCall<MetodoPagoRow>("metodos_pago_obtener_por_id", { p_id });
}

export function metodosPagoListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: MetodoPagoRow[]; total: number; limite: number | null; offset: number }>(
    "metodos_pago_listar",
    { p_limite, p_offset }
  );
}

export function metodosPagoListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: MetodoPagoRow[]; total: number; limite: number | null; offset: number }>(
    "metodos_pago_listar_todos",
    { p_limite, p_offset }
  );
}

export function metodosPagoActualizar(params: MetodoPagoUpdateParams) {
  return rpcCall<MetodoPagoRow>("metodos_pago_actualizar", params);
}

export function metodosPagoEliminar(p_id: number) {
  return rpcCall<MetodoPagoRow>("metodos_pago_eliminar", { p_id });
}

