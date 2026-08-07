import "server-only";

import type { CalificacionGroomerInsertParams, CalificacionGroomerRow } from "./types";
import { rpcCall } from "./core";

export function calificacionesGroomerInsertar(params: CalificacionGroomerInsertParams) {
  return rpcCall<CalificacionGroomerRow>("calificaciones_groomer_insertar", params);
}
