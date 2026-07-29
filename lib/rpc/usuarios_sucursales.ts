import "server-only";

import type {
  UsuarioSucursalInsertParams,
  UsuarioSucursalRow,
  UsuarioSucursalUpdateParams
} from "./types";
import { rpcCall } from "./core";

export function usuariosSucursalesInsertar(params: UsuarioSucursalInsertParams) {
  return rpcCall<UsuarioSucursalRow>("usuarios_sucursales_insertar", params);
}

export function usuariosSucursalesObtenerPorId(p_usuario_id: string, p_sucursal_id: number) {
  return rpcCall<UsuarioSucursalRow>("usuarios_sucursales_obtener_por_id", { p_usuario_id, p_sucursal_id });
}

export function usuariosSucursalesListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: UsuarioSucursalRow[]; total: number; limite: number | null; offset: number }>(
    "usuarios_sucursales_listar",
    { p_limite, p_offset }
  );
}

export function usuariosSucursalesListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: UsuarioSucursalRow[]; total: number; limite: number | null; offset: number }>(
    "usuarios_sucursales_listar_todos",
    { p_limite, p_offset }
  );
}

export function usuariosSucursalesActualizar(params: UsuarioSucursalUpdateParams) {
  return rpcCall<UsuarioSucursalRow>("usuarios_sucursales_actualizar", params);
}

export function usuariosSucursalesEliminar(p_usuario_id: string, p_sucursal_id: number) {
  return rpcCall<UsuarioSucursalRow>("usuarios_sucursales_eliminar", { p_usuario_id, p_sucursal_id });
}

