export type ServiceCompletedEmail = {
  notificationId: number;
  to: string;
  clientName: string;
  petName: string;
  branchName: string;
};

export type EmailResult = {
  messageId?: string;
};

export interface EmailProvider {
  sendServiceCompleted(input: ServiceCompletedEmail): Promise<EmailResult>;
}
