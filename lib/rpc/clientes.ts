import "server-only";

import type { ClienteInsertParams, ClienteProgresoFidelidadRow, ClienteRow, ClienteUpdateParams } from "./types";
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
