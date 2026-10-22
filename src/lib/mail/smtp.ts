import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import type { MailboxWithPassword } from "./credentials";

function transport(mb: MailboxWithPassword) {
  return nodemailer.createTransport({
    host: mb.smtp_host,
    port: mb.smtp_port,
    secure: mb.smtp_secure,
    auth: { user: mb.username, pass: mb.password },
  });
}

export async function testSmtp(mb: MailboxWithPassword) {
  await transport(mb).verify();
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(text: string) {
  const linked = escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#111">${linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
}

export async function sendMail(
  mb: MailboxWithPassword,
  opts: { to: string; subject: string; text: string; inReplyTo?: string | null; references?: string[] },
) {
  const messageId = `<${randomUUID()}@${mb.email.split("@")[1] ?? "localhost"}>`;
  const message: Mail.Options = {
    messageId,
    from: mb.display_name ? { name: mb.display_name, address: mb.email } : mb.email,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: textToHtml(opts.text),
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references?.length ? opts.references : undefined,
  };
  const raw = await new MailComposer(message).compile().build();
  await transport(mb).sendMail({ envelope: { from: mb.email, to: [opts.to] }, raw });
  return { messageId, raw };
}
