import "server-only";

import { GmailEmailProvider } from "./gmail-provider";
import type { EmailProvider } from "./types";

let warned = false;

function disabled(reason: string) {
  if (!warned) {
    console.warn(`[email] Delivery disabled: ${reason}`);
    warned = true;
  }
  return { provider: null, reason } as const;
}

export function createEmailProvider(): { provider: EmailProvider | null; reason?: string } {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider !== "gmail") return disabled(provider ? "email_provider_unsupported" : "email_provider_not_configured");

  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const fromName = process.env.EMAIL_FROM_NAME?.trim();
  if (!user || !appPassword || !fromName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    return disabled("email_provider_not_configured");
  }

  return { provider: new GmailEmailProvider({ user, appPassword, fromName }) };
}
