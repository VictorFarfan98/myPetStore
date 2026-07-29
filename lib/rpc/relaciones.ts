import "server-only";

import type { ClientesDetalleParams, MascotaRow, MascotaTransferirClienteParams, MascotasHistorialParams } from "./types";
import { rpcCall } from "./core";

export function mascotasTransferirCliente(params: MascotaTransferirClienteParams) {
  return rpcCall<MascotaRow>("mascotas_transferir_cliente", params);
}

export function mascotasObtenerHistorial(params: MascotasHistorialParams) {
  return rpcCall<Record<string, unknown>[]>("mascotas_obtener_historial", params);
}

export function mascotasObtenerHistorialCompleto(params: MascotasHistorialParams) {
  return rpcCall<Record<string, unknown>[]>("mascotas_obtener_historial_completo", params);
}

export function clientesObtenerDetalle(params: ClientesDetalleParams) {
  return rpcCall<Record<string, unknown>>("clientes_obtener_detalle", params);
}

