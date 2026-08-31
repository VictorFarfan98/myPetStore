import "server-only";

import {
  notificacionesEmailMarcarEnviada,
  notificacionesEmailMarcarFallida,
  notificacionesEmailPreparar,
  notificacionesEmailReclamarPendiente,
  notificacionesEmailReintentar
} from "@/lib/rpc/notificaciones_email";
import type { EmailNotificationRow } from "@/lib/rpc/types";
import { SendServiceCompletedEmail } from "./send-service-completed-email";
import { createEmailProvider } from "./provider";

type DeliveryResult = "sent" | "failed" | "skipped";

async function deliver(row: EmailNotificationRow): Promise<DeliveryResult> {
  const token = row.procesando_token;
  if (!token || !row.destinatario) return "skipped";

  const configured = createEmailProvider();
  if (!configured.provider) {
    await notificacionesEmailMarcarFallida(row.id, token, configured.reason ?? "email_provider_not_configured");
    return "failed";
  }

  try {
    const result = await new SendServiceCompletedEmail(configured.provider).send({
      notificationId: row.id,
      to: row.destinatario,
      clientName: row.cliente_nombre,
      petName: row.mascota_nombre,
      branchName: row.sucursal_nombre
    });
    const marked = await notificacionesEmailMarcarEnviada(row.id, token, result.messageId ?? null);
    if (marked.error || marked.data !== true) {
      console.error("Email delivery completed but notification state could not be updated", { notificationId: row.id });
      return "failed";
    }
    return "sent";
  } catch {
    console.error("Email delivery failed", { notificationId: row.id, reason: "email_send_failed" });
    const marked = await notificacionesEmailMarcarFallida(row.id, token, "email_send_failed");
    if (marked.error) console.error("Email notification failure state could not be updated", { notificationId: row.id });
    return "failed";
  }
}

export async function sendNewServiceCompletedEmail(recordId: number) {
  try {
    const prepared = await notificacionesEmailPreparar(recordId);
    if (prepared.error || !prepared.data?.creada || prepared.data.estado !== "pending") return "skipped" as const;
    const claimed = await notificacionesEmailReclamarPendiente(prepared.data.id);
    if (claimed.error || !claimed.data) return "skipped" as const;
    return deliver(claimed.data);
  } catch {
    console.error("Email notification preparation failed", { recordId, reason: "email_notification_unavailable" });
    return "skipped" as const;
  }
}

export async function retryServiceCompletedEmail(notificationId: number) {
  try {
    const claimed = await notificacionesEmailReintentar(notificationId);
    if (claimed.error) return { error: "No se pudo preparar el reintento del correo." };
    if (!claimed.data) return { error: "El correo ya fue enviado o está siendo procesado." };
    const result = await deliver(claimed.data);
    return result === "sent" ? { ok: true } : { error: "No se pudo enviar el correo. Revisa la configuración e inténtalo de nuevo." };
  } catch {
    return { error: "No se pudo reintentar el correo." };
  }
}
