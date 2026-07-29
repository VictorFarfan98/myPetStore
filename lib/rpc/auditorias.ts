import "server-only";

import type { AuditoriaRow } from "./types";
import { rpcCall } from "./core";

export function auditoriasObtenerPorId(p_id: number) {
  return rpcCall<AuditoriaRow>("auditorias_obtener_por_id", { p_id });
}

export function auditoriasListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: AuditoriaRow[]; total: number; limite: number | null; offset: number }>(
    "auditorias_listar",
    { p_limite, p_offset }
  );
}

export function auditoriasListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: AuditoriaRow[]; total: number; limite: number | null; offset: number }>(
    "auditorias_listar_todos",
    { p_limite, p_offset }
  );
}

