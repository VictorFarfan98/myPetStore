import "server-only";

import type {
  PrecioShampooInsertParams,
  PrecioShampooRow,
  PrecioShampooUpdateParams
} from "./types";
import { rpcCall } from "./core";

export function preciosShampooInsertar(params: PrecioShampooInsertParams) {
  return rpcCall<PrecioShampooRow>("precios_shampoo_insertar", params);
}

export function preciosShampooObtenerPorId(p_shampoo_id: number, p_tamano_id: number) {
  return rpcCall<PrecioShampooRow>("precios_shampoo_obtener_por_id", { p_shampoo_id, p_tamano_id });
}

export function preciosShampooListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PrecioShampooRow[]; total: number; limite: number | null; offset: number }>(
    "precios_shampoo_listar",
    { p_limite, p_offset }
  );
}

export function preciosShampooListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PrecioShampooRow[]; total: number; limite: number | null; offset: number }>(
    "precios_shampoo_listar_todos",
    { p_limite, p_offset }
  );
}

export function preciosShampooActualizar(params: PrecioShampooUpdateParams) {
  return rpcCall<PrecioShampooRow>("precios_shampoo_actualizar", params);
}

export function preciosShampooEliminar(p_shampoo_id: number, p_tamano_id: number) {
  return rpcCall<PrecioShampooRow>("precios_shampoo_eliminar", { p_shampoo_id, p_tamano_id });
}

