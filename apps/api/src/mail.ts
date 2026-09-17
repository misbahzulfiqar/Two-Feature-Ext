import { createLogger } from "@sell-similar/logging";
import nodemailer from "nodemailer";
import type { ApiEnv } from "./env.js";

const mailLog = createLogger({ name: "mail" });
const lastVerificationLink = new Map<string, string>();

export function mailDeliveryEnabled(env: ApiEnv): boolean {
  return Boolean(env.RESEND_API_KEY || env.SMTP_HOST);
}

export function publicAuthUrl(env: ApiEnv, url: string): string {
  try {
    const parsed = new URL(url);
    const callback = parsed.searchParams.get("callbackURL") ?? "";
    const useAdmin =
      callback.startsWith(env.ADMIN_APP_URL) ||
      callback.includes("://localhost:3005") ||
      callback.includes("://127.0.0.1:3005");
    const origin = new URL(useAdmin ? env.ADMIN_APP_URL : env.WEB_APP_URL);
    parsed.protocol = origin.protocol;
    parsed.host = origin.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function rememberVerificationLink(email: string, url: string): void {
  lastVerificationLink.set(email.trim().toLowerCase(), url);
}

export function peekVerificationLink(email: string): string | undefined {
  return lastVerificationLink.get(email.trim().toLowerCase());
}

export type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

function fromAddress(env: ApiEnv): string {
  return env.EMAIL_FROM || env.SMTP_USER || "eBay Sell Similar <noreply@ebaysellsimilar.com>";
}

async function sendWithResend(env: ApiEnv, email: AuthEmail): Promise<void> {
  const key = env.RESEND_API_KEY;
  if (!key) {
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(env),
      to: [email.to],
      subject: email.subject,
      text: email.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend ${response.status}: ${body.slice(0, 300)}`);
  }
}

async function sendWithSmtp(env: ApiEnv, email: AuthEmail): Promise<void> {
  if (!env.SMTP_HOST) {
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  await transporter.sendMail({
    from: fromAddress(env),
    to: email.to,
    subject: email.subject,
    text: email.text,
  });
}

export async function sendAuthEmail(env: ApiEnv, email: AuthEmail): Promise<void> {
  if (env.RESEND_API_KEY) {
    await sendWithResend(env, email);
    return;
  }
  if (env.SMTP_HOST) {
    await sendWithSmtp(env, email);
    return;
  }
  mailLog.info(
    { to: email.to, subject: email.subject, text: email.text },
    "Better Auth verification URL (no SMTP/Resend; open this link to verify)",
  );
}
