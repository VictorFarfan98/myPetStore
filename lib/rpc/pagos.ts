import "server-only";

import type { PagoRow, PagosReemplazarListaParams } from "./types";
import { rpcCall } from "./core";

export function pagosObtenerPorId(p_id: number) {
  return rpcCall<PagoRow>("pagos_obtener_por_id", { p_id });
}

export function pagosListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PagoRow[]; total: number; limite: number | null; offset: number }>(
    "pagos_listar",
    { p_limite, p_offset }
  );
}

export function pagosListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PagoRow[]; total: number; limite: number | null; offset: number }>(
    "pagos_listar_todos",
    { p_limite, p_offset }
  );
}

export function pagosReemplazarLista(params: PagosReemplazarListaParams) {
  return rpcCall<Record<string, unknown>>("pagos_reemplazar_lista", params);
}
