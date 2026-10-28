import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

const API = "https://api.resend.com/emails";
const DEFAULT_FROM = "Janngude <onboarding@resend.dev>";

/** SMTP configuré (Gmail, Brevo, OVH…) : prioritaire sur Resend. Ne nécessite pas de domaine. */
export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function emailConfigured() {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY);
}

export function emailFrom() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  // Avec un SMTP, l’expéditeur par défaut est le compte SMTP lui-même (Gmail impose son adresse).
  if (smtpConfigured() && /@/.test(process.env.SMTP_USER ?? "")) return `Janngude <${process.env.SMTP_USER}>`;
  return DEFAULT_FROM;
}

/** Transport SMTP réutilisé entre les envois. */
let transport: Transporter | null = null;
function smtpTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Gabarit commun aux e-mails de l’application (même style que les modèles Supabase). */
export function renderEmail(input: { title: string; intro: string; button?: { label: string; url: string }; outro?: string; footnote?: string }) {
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const outro = input.outro ? escapeHtml(input.outro) : "";
  const footnote = input.footnote ? escapeHtml(input.footnote) : "";
  const button = input.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#121212;border-radius:999px;"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(input.button.label)}</a></td></tr></table>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#7c7c7c;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br /><a href="${escapeHtml(input.button.url)}" style="color:#121212;word-break:break-all;">${escapeHtml(input.button.url)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#d9f0f5;font-family:Rubik,'Segoe UI',Helvetica,Arial,sans-serif;color:#121212;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#d9f0f5;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
      <tr><td style="background:#121212;border-radius:28px 28px 0 0;padding:22px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="width:34px;height:34px;background:#1f1f1f;border-radius:10px;text-align:center;vertical-align:middle;"><span style="display:inline-block;width:16px;height:3px;background:#d8f6dc;border-radius:2px;"></span></td>
          <td style="padding-left:12px;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">Janngude</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;padding:36px 32px 28px;">
        <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:#121212;">${title}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3b3b3b;">${intro}</p>
        ${button}
        ${outro ? `<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#3b3b3b;">${outro}</p>` : ""}
      </td></tr>
      <tr><td style="background:#f4f4f4;border-radius:0 0 28px 28px;padding:18px 32px;font-size:12px;line-height:1.6;color:#7c7c7c;">
        ${footnote ? `${footnote}<br />` : ""}Janngude — réviser mieux, plus vite.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export class EmailError extends Error {}

/** Envoie un e-mail : par SMTP si configuré, sinon via Resend. */
export async function sendEmail(input: { to: string; subject: string; html: string; replyTo?: string }) {
  if (smtpConfigured()) {
    try {
      const info = await smtpTransport().sendMail({ from: emailFrom(), to: input.to, subject: input.subject, html: input.html, replyTo: input.replyTo });
      return { id: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur SMTP.";
      if (/invalid login|username and password not accepted|authentication failed|535/i.test(message)) {
        throw new EmailError("Identifiants SMTP refusés. Avec Gmail, utilisez un mot de passe d’application (validation en deux étapes requise), pas le mot de passe du compte.");
      }
      throw new EmailError(`Envoi SMTP impossible : ${message}`);
    }
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailError("L’envoi d’e-mails n’est pas configuré (SMTP_* ou RESEND_API_KEY).");
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom(), to: [input.to], subject: input.subject, html: input.html, reply_to: input.replyTo }),
  });
  if (!res.ok) {
    let message = `Resend a répondu ${res.status}.`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new EmailError(message);
  }
  return (await res.json()) as { id: string };
}
