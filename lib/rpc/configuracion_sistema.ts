import "server-only";

import type { ConfiguracionSistemaRow, ConfiguracionSistemaUpdateParams } from "./types";
import { rpcCall } from "./core";

export function configuracionSistemaObtener() {
  return rpcCall<ConfiguracionSistemaRow>("configuracion_sistema_obtener");
}

export function configuracionSistemaActualizar(params: ConfiguracionSistemaUpdateParams) {
  return rpcCall<ConfiguracionSistemaRow>("configuracion_sistema_actualizar", params);
}

