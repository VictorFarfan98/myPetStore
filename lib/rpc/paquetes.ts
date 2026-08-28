import "server-only";

import type { PaqueteCrearParams, PaqueteRow } from "./types";
import { rpcCall } from "./core";

export function paquetesCrear(params: PaqueteCrearParams) {
  return rpcCall<PaqueteRow>("paquetes_crear", params);
}

export function paquetesListar() {
  return rpcCall<PaqueteRow[]>("paquetes_listar");
}

export function paquetesAsignar(p_paquete_id: number, p_cliente_id: number) {
  return rpcCall<{ asignacion: unknown; cupones_generados: number }>("paquetes_asignar", { p_paquete_id, p_cliente_id });
}
