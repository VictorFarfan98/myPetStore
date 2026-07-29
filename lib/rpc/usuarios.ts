import "server-only";

import type { UsuarioInsertParams, UsuarioRow, UsuarioUpdateParams } from "./types";
import { rpcCall } from "./core";

export function usuariosInsertar(params: UsuarioInsertParams) {
  return rpcCall<UsuarioRow>("usuarios_insertar", params);
}

export function usuariosObtenerPorId(p_id: string) {
  return rpcCall<UsuarioRow>("usuarios_obtener_por_id", { p_id });
}

export function usuariosListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: UsuarioRow[]; total: number; limite: number | null; offset: number }>(
    "usuarios_listar",
    { p_limite, p_offset }
  );
}

export function usuariosListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: UsuarioRow[]; total: number; limite: number | null; offset: number }>(
    "usuarios_listar_todos",
    { p_limite, p_offset }
  );
}

export function usuariosActualizar(params: UsuarioUpdateParams) {
  return rpcCall<UsuarioRow>("usuarios_actualizar", params);
}

export function usuariosEliminar(p_id: string) {
  return rpcCall<UsuarioRow>("usuarios_eliminar", { p_id });
}

export function usuariosObtenerPerfilActual() {
  return rpcCall<Record<string, unknown>>("usuarios_obtener_perfil_actual");
}

export function usuariosListarDisponiblesParaAsignacion() {
  return rpcCall<UsuarioRow[]>("usuarios_listar_disponibles_para_asignacion");
}
