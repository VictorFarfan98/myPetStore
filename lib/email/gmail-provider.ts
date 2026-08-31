import "server-only";

import nodemailer from "nodemailer";
import type { EmailProvider, EmailResult, ServiceCompletedEmail } from "./types";

type GmailConfig = {
  user: string;
  appPassword: string;
  fromName: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function headerValue(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

export class GmailEmailProvider implements EmailProvider {
  private readonly transporter;

  constructor(private readonly config: GmailConfig) {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.user, pass: config.appPassword }
    });
  }

  async sendServiceCompleted(input: ServiceCompletedEmail): Promise<EmailResult> {
    const clientName = headerValue(input.clientName);
    const petName = headerValue(input.petName);
    const branchName = headerValue(input.branchName);
    const brandName = headerValue(this.config.fromName);
    const message = await this.transporter.sendMail({
      from: { name: this.config.fromName, address: this.config.user },
      to: input.to,
      subject: `El servicio de ${petName} ha finalizado`,
      messageId: `<service-completed-${input.notificationId}@${this.config.user.split("@")[1]}>`,
      text: `Hola ${clientName},\n\nTe confirmamos que el servicio de grooming de ${petName} ha finalizado en ${branchName}. Tu mascota ya puede ser recogida.\n\nGracias por confiar en ${brandName}.`,
      html: `<p>Hola ${escapeHtml(clientName)},</p><p>Te confirmamos que el servicio de grooming de <strong>${escapeHtml(petName)}</strong> ha finalizado en <strong>${escapeHtml(branchName)}</strong>.</p><p>Tu mascota ya puede ser recogida.</p><p>Gracias por confiar en ${escapeHtml(brandName)}.</p>`
    });

    return { messageId: message.messageId };
  }
}
