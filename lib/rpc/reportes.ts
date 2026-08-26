import "server-only";

import { rpcCall } from "./core";
import { RPC_NAMES } from "./names";
import type { ReportePeluquerosResult, ReporteSucursalesResult } from "./types";

export function reportesPeluquerosObtener() {
  return rpcCall<ReportePeluquerosResult>(RPC_NAMES.groomerReport);
}

export function reportesSucursalesObtener() {
  return rpcCall<ReporteSucursalesResult>(RPC_NAMES.branchReport);
}
