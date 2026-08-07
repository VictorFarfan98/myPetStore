import "server-only";

import type {
  RegistroServicioInsertParams,
  RegistroServicioIniciarParams,
  RegistroServicioRow,
  RegistroServicioUpdateParams,
  RegistrosServicioCompletarParams
} from "./types";
import { rpcCall } from "./core";

export function registrosServicioInsertar(params: RegistroServicioInsertParams) {
  return rpcCall<RegistroServicioRow>("registros_servicio_insertar", params);
}

export function registrosServicioIniciar(params: RegistroServicioIniciarParams) {
  console.log("registrosServicioIniciar params", params);
  return rpcCall<RegistroServicioRow>("registros_servicio_iniciar", params);
}

export function registrosServicioObtenerPorId(p_id: number) {
  return rpcCall<RegistroServicioRow>("registros_servicio_obtener_por_id", { p_id });
}

export function registrosServicioListar(p_limite: number | null = null, p_offset = 0, p_sucursal_id: number | null = null) {
  return rpcCall<{ datos: RegistroServicioRow[]; total: number; limite: number | null; offset: number }>(
    "registros_servicio_listar",
    { p_limite, p_offset, p_sucursal_id }
  );
}

export function registrosServicioListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: RegistroServicioRow[]; total: number; limite: number | null; offset: number }>(
    "registros_servicio_listar_todos",
    { p_limite, p_offset }
  );
}

export function registrosServicioActualizar(params: RegistroServicioUpdateParams) {
  console.log("registrosServicioActualizar params", params);
  return rpcCall<RegistroServicioRow>("registros_servicio_actualizar", params);
}

export function registrosServicioEliminar(p_id: number) {
  return rpcCall<RegistroServicioRow>("registros_servicio_eliminar", { p_id });
}

export function registrosServicioCompletar(params: RegistrosServicioCompletarParams) {
  return rpcCall<Record<string, unknown>>("registros_servicio_completar", params);
}

export function registrosServicioObtenerDetalle(p_registro_servicio_id: number) {
  return rpcCall<Record<string, unknown>>("registros_servicio_obtener_detalle", { p_registro_servicio_id });
}
