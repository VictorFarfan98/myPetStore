import "server-only";

import type {
  PrecioServicioInsertParams,
  PrecioServicioRow,
  PrecioServicioUpdateParams
} from "./types";
import { rpcCall } from "./core";

export function preciosServiciosInsertar(params: PrecioServicioInsertParams) {
  return rpcCall<PrecioServicioRow>("precios_servicios_insertar", params);
}

export function preciosServiciosObtenerPorId(p_servicio_id: number, p_tamano_id: number) {
  return rpcCall<PrecioServicioRow>("precios_servicios_obtener_por_id", { p_servicio_id, p_tamano_id });
}

export function preciosServiciosListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PrecioServicioRow[]; total: number; limite: number | null; offset: number }>(
    "precios_servicios_listar",
    { p_limite, p_offset }
  );
}

export function preciosServiciosListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PrecioServicioRow[]; total: number; limite: number | null; offset: number }>(
    "precios_servicios_listar_todos",
    { p_limite, p_offset }
  );
}

export function preciosServiciosActualizar(params: PrecioServicioUpdateParams) {
  return rpcCall<PrecioServicioRow>("precios_servicios_actualizar", params);
}

export function preciosServiciosEliminar(p_servicio_id: number, p_tamano_id: number) {
  return rpcCall<PrecioServicioRow>("precios_servicios_eliminar", { p_servicio_id, p_tamano_id });
}

