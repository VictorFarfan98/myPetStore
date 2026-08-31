import "server-only";

import { rpcCall } from "./core";
import type { EmailNotificationRow } from "./types";

export function notificacionesEmailPreparar(p_registro_servicio_id: number) {
  return rpcCall<EmailNotificationRow & { creada: boolean }>("notificaciones_email_servicio_completado_preparar", { p_registro_servicio_id });
}

export function notificacionesEmailReclamarPendiente(p_id: number) {
  return rpcCall<EmailNotificationRow>("notificaciones_email_reclamar_pendiente", { p_id });
}

export function notificacionesEmailReintentar(p_id: number) {
  return rpcCall<EmailNotificationRow>("notificaciones_email_reintentar", { p_id });
}

export function notificacionesEmailMarcarEnviada(p_id: number, p_token: string, p_proveedor_mensaje_id: string | null) {
  return rpcCall<boolean>("notificaciones_email_marcar_enviada", { p_id, p_token, p_proveedor_mensaje_id });
}

export function notificacionesEmailMarcarFallida(p_id: number, p_token: string, p_error: string) {
  return rpcCall<boolean>("notificaciones_email_marcar_fallida", { p_id, p_token, p_error });
}

export function notificacionesEmailListar(params: {
  p_limite: number;
  p_offset: number;
  p_desde: string | null;
  p_hasta: string | null;
  p_cliente_id: number | null;
}) {
  return rpcCall<{ datos: EmailNotificationRow[]; total: number; limite: number; offset: number }>("notificaciones_email_listar", params);
}
