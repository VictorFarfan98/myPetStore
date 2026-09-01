import "server-only";

import type { PeluqueroInsertParams, PeluqueroRow, PeluqueroUpdateParams } from "./types";
import { rpcCall } from "./core";

export function peluquerosInsertar(params: PeluqueroInsertParams) {
  return rpcCall<PeluqueroRow>("peluqueros_insertar", params);
}

export function peluquerosObtenerPorId(p_id: number) {
  return rpcCall<PeluqueroRow>("peluqueros_obtener_por_id", { p_id });
}

export function peluquerosListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PeluqueroRow[]; total: number; limite: number | null; offset: number }>(
    "peluqueros_listar",
    { p_limite, p_offset }
  );
}

export function peluquerosListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: PeluqueroRow[]; total: number; limite: number | null; offset: number }>(
    "peluqueros_listar_todos",
    { p_limite, p_offset }
  );
}

export function peluquerosActualizar(params: PeluqueroUpdateParams) {
  return rpcCall<PeluqueroRow>("peluqueros_actualizar", params);
}

export function peluquerosEliminar(p_id: number) {
  return rpcCall<PeluqueroRow>("peluqueros_eliminar", { p_id });
}

export function peluquerosVincularUsuario(p_peluquero_id: number, p_usuario_id: string | null) {
  return rpcCall<PeluqueroRow>("peluqueros_vincular_usuario", { p_peluquero_id, p_usuario_id });
}
