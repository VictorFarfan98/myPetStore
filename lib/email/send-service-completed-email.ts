import "server-only";

import type { EmailProvider, EmailResult, ServiceCompletedEmail } from "./types";

export class SendServiceCompletedEmail {
  constructor(private readonly provider: EmailProvider) {}

  send(input: ServiceCompletedEmail): Promise<EmailResult> {
    return this.provider.sendServiceCompleted(input);
  }
}
