import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function send(to: string, subject: string, text: string, html: string) {
  if (!transport) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

/** Fire-and-forget: a mail failure must never fail or slow the auth request. */
function sendInBackground(...args: Parameters<typeof send>) {
  send(...args).catch((err) => console.error("Email send failed:", err.message));
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export function sendWelcomeEmail(to: string, name: string) {
  const text = `Hi ${name},\n\nWelcome to EcoLinkr! Your account is ready.\n\nIf you didn't create it, please contact support.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>Welcome to EcoLinkr! Your account is ready.</p><p>If you didn't create it, please contact support.</p>`;
  sendInBackground(to, "Welcome to EcoLinkr", text, html);
}

export function sendLoginAlertEmail(to: string, name: string, ctx: RequestContext) {
  const when = new Date().toUTCString();
  const where = `IP: ${ctx.ip ?? "unknown"}\nDevice: ${ctx.userAgent ?? "unknown"}`;
  const text = `Hi ${name},\n\nNew sign-in from a device we don't recognise on your EcoLinkr account at ${when}.\n${where}\n\nIf this wasn't you, change your password and contact support.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>New sign-in from a device we don't recognise on your EcoLinkr account at ${escapeHtml(when)}.</p><p>IP: ${escapeHtml(ctx.ip ?? "unknown")}<br>Device: ${escapeHtml(ctx.userAgent ?? "unknown")}</p><p>If this wasn't you, change your password and contact support.</p>`;
  sendInBackground(to, "New device sign-in to EcoLinkr", text, html);
}

export function sendOtpEmail(to: string, code: string) {
  const text = `Your EcoLinkr login code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes. Don't share it with anyone.`;
  const html = `<p>Your EcoLinkr login code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in ${env.OTP_TTL_MINUTES} minutes. Don't share it with anyone.</p>`;
  sendInBackground(to, "Your EcoLinkr login code", text, html);
}

export function sendPasswordResetEmail(to: string, name: string, link: string) {
  const text = `Hi ${name},\n\nWe received a request to reset your EcoLinkr password. Use this link within ${env.PASSWORD_RESET_TTL_MINUTES} minutes:\n\n${link}\n\nIf you didn't ask for this, ignore this email; your password won't change.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>We received a request to reset your EcoLinkr password. Use this link within ${env.PASSWORD_RESET_TTL_MINUTES} minutes:</p><p><a href="${escapeHtml(link)}">Reset your password</a></p><p>If you didn't ask for this, ignore this email; your password won't change.</p>`;
  sendInBackground(to, "Reset your EcoLinkr password", text, html);
}

export function sendPasswordChangedEmail(to: string, name: string) {
  const text = `Hi ${name},\n\nYour EcoLinkr password was just changed and you've been signed out of other devices.\n\nIf this wasn't you, reset your password immediately and contact support.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>Your EcoLinkr password was just changed and you've been signed out of other devices.</p><p>If this wasn't you, reset your password immediately and contact support.</p>`;
  sendInBackground(to, "Your EcoLinkr password was changed", text, html);
}
