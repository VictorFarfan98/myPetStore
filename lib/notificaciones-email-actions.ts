"use server";

import { revalidatePath } from "next/cache";
import { retryServiceCompletedEmail } from "@/lib/email/delivery";

export async function retryEmailNotification(formData: FormData) {
  const notificationId = Number(formData.get("id"));
  if (!Number.isInteger(notificationId) || notificationId < 1) return { error: "La notificación seleccionada no es válida." };
  const result = await retryServiceCompletedEmail(notificationId);
  revalidatePath("/correos");
  return result;
}
