import "server-only";

import type {
  RecordatorioCitaDeleteParams,
  RecordatorioCitaInsertParams,
  RecordatorioCitaRow
} from "./types";
import { rpcCall } from "./core";

export function recordatoriosCitasInsertar(params: RecordatorioCitaInsertParams) {
  return rpcCall<RecordatorioCitaRow>("recordatorios_citas_insertar", params);
}

export function recordatoriosCitasObtenerPorId(p_id: number) {
  return rpcCall<RecordatorioCitaRow>("recordatorios_citas_obtener_por_id", { p_id });
}

export function recordatoriosCitasListar(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: RecordatorioCitaRow[]; total: number; limite: number | null; offset: number }>(
    "recordatorios_citas_listar",
    { p_limite, p_offset }
  );
}

export function recordatoriosCitasListarTodos(p_limite: number | null = null, p_offset = 0) {
  return rpcCall<{ datos: RecordatorioCitaRow[]; total: number; limite: number | null; offset: number }>(
    "recordatorios_citas_listar_todos",
    { p_limite, p_offset }
  );
}

export function recordatoriosCitasEliminar(params: RecordatorioCitaDeleteParams) {
  return rpcCall<RecordatorioCitaRow>("recordatorios_citas_eliminar", params);
}

