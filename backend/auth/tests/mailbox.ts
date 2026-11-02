export interface Mail {
  type: "welcome" | "loginAlert" | "otp" | "passwordReset" | "passwordChanged";
  to: string;
  code?: string;
  link?: string;
  name?: string;
  ctx?: { ip?: string; userAgent?: string; deviceId?: string };
}

/** Emails the service "sent" during the current test (the real mailer is mocked out). */
export const mailbox: Mail[] = [];

export const mailsOf = (type: Mail["type"], to?: string) =>
  mailbox.filter((m) => m.type === type && (!to || m.to === to));

export const lastMail = (type: Mail["type"], to?: string) => mailsOf(type, to).at(-1);
