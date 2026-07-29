import "server-only";

import type { CitaInsertParams, CitaRow, CitaUpdateParams, CitasAgendaParams, CitasMotivoParams, CitasReprogramarParams } from "./types";
import { rpcCall } from "./core";

export function citasInsertar(params: CitaInsertParams) {
  return rpcCall<CitaRow>("citas_insertar", params);
}

export function citasObtenerPorId(p_id: number) {
  return rpcCall<CitaRow>("citas_obtener_por_id", { p_id });
}

export function citasListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: CitaRow[]; total: number; limite: number | null; offset: number }>(
    "citas_listar",
    { p_limite, p_offset }
  );
}

export function citasListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: CitaRow[]; total: number; limite: number | null; offset: number }>(
    "citas_listar_todos",
    { p_limite, p_offset }
  );
}

export function citasActualizar(params: CitaUpdateParams) {
  return rpcCall<CitaRow>("citas_actualizar", params);
}

export function citasEliminar(p_id: number) {
  return rpcCall<CitaRow>("citas_eliminar", { p_id });
}

export function citasReprogramar(params: CitasReprogramarParams) {
  return rpcCall<CitaRow>("citas_reprogramar", params);
}

export function citasCancelar(params: CitasMotivoParams) {
  return rpcCall<CitaRow>("citas_cancelar", params);
}

export function citasMarcarNoAsistio(params: CitasMotivoParams) {
  return rpcCall<CitaRow>("citas_marcar_no_asistio", params);
}

export function citasObtenerAgenda(params: CitasAgendaParams) {
  return rpcCall<Record<string, unknown>[]>("citas_obtener_agenda", params);
}
