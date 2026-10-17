import nodemailer from "nodemailer";

import type { Env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";

export type PasswordResetMessage = {
  email: string;
  resetUrl: string;
};

/** Sends the raw reset link once. Callers must not persist or return that link. */
export type PasswordResetMailer = (
  message: PasswordResetMessage,
) => Promise<void>;

type SmtpSettings = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/**
 * Sends the reset link by SMTP when SMTP_* is fully configured.
 * With no SMTP settings, development prints the link in the server log.
 */
export function createPasswordResetMailer(
  env: Env,
  logger: Logger,
): PasswordResetMailer {
  const smtp = readSmtpSettings(env);

  if (!smtp) {
    return async function logPasswordReset(message) {
      if (env.NODE_ENV === "development") {
        logger.info(
          { email: message.email, resetUrl: message.resetUrl },
          "Password reset link (development only; SMTP is not configured)",
        );
        return;
      }

      logger.warn(
        { email: message.email },
        "Password reset email was not sent because SMTP is not configured",
      );
    };
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  return async function sendPasswordReset(message) {
    await transport.sendMail({
      from: smtp.from,
      to: message.email,
      subject: "Reset your Nesma Bloom password",
      text: [
        "Use this link to reset your Nesma Bloom password.",
        "The link expires in 30 minutes and works once.",
        "",
        message.resetUrl,
      ].join("\n"),
      html: `<p>Use this link to reset your Nesma Bloom password. It expires in 30 minutes and works once.</p><p><a href="${escapeHtml(message.resetUrl)}">Reset password</a></p>`,
    });

    logger.info({ email: message.email }, "Password reset email sent");
  };
}

function readSmtpSettings(env: Env): SmtpSettings | null {
  const host = env.SMTP_HOST.trim();
  const user = env.SMTP_USER.trim();
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM.trim();
  const any = host !== "" || user !== "" || pass !== "" || from !== "";

  if (!any) {
    return null;
  }

  if (host === "" || user === "" || pass === "" || from === "") {
    throw new Error(
      "SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM must all be set to send email.",
    );
  }

  return { host, port: env.SMTP_PORT, user, pass, from };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
