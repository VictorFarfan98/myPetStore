import "server-only";

import type { ClienteFidelidadReconciliacionRow, ClienteInsertParams, ClienteProgresoFidelidadRow, ClienteRow, ClienteUpdateParams } from "./types";
import { rpcCall } from "./core";

export function clientesInsertar(params: ClienteInsertParams) {
  return rpcCall<ClienteRow>("clientes_insertar", params);
}

export function clientesObtenerPorId(p_id: number) {
  return rpcCall<ClienteRow>("clientes_obtener_por_id", { p_id });
}

export function clientesListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: ClienteRow[]; total: number; limite: number | null; offset: number }>(
    "clientes_listar",
    { p_limite, p_offset }
  );
}

export function clientesBuscarListar(p_busqueda: string, p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: ClienteRow[]; total: number; limite: number | null; offset: number }>(
    "clientes_buscar_listar",
    { p_busqueda, p_limite, p_offset }
  );
}

export function clientesListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: ClienteRow[]; total: number; limite: number | null; offset: number }>(
    "clientes_listar_todos",
    { p_limite, p_offset }
  );
}

export function clientesActualizar(params: ClienteUpdateParams) {
  return rpcCall<ClienteRow>("clientes_actualizar", params);
}

export function clientesEliminar(p_id: number) {
  return rpcCall<ClienteRow>("clientes_eliminar", { p_id });
}

export function clientesProgresoFidelidadListar() {
  return rpcCall<ClienteProgresoFidelidadRow[]>("clientes_progreso_fidelidad_listar");
}

export function clientesFidelidadActualizar(p_cliente_id: number, p_servicio_id: number, p_completados: number, p_motivo: string) {
  return rpcCall<Record<string, unknown>>("clientes_fidelidad_actualizar", { p_cliente_id, p_servicio_id, p_completados, p_motivo });
}

export function clientesFidelidadReconciliar() {
  return rpcCall<ClienteFidelidadReconciliacionRow[]>("clientes_fidelidad_reconciliar");
}
