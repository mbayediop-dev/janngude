#!/usr/bin/env node
/**
 * Installe les modèles d’e-mail personnalisés (supabase/email-templates/*.html) dans le projet
 * Supabase via l’API de gestion, et, en option, le SMTP Resend et les URL de redirection.
 *
 *   npm run email:push                      modèles + objets
 *   npm run email:push -- --smtp            + SMTP Resend (RESEND_API_KEY, EMAIL_FROM d’un domaine vérifié)
 *   npm run email:push -- --site-url=https://janngude.app   + Site URL et URL de redirection
 *   npm run email:push -- --autoconfirm=on|off  inscription sans e-mail de confirmation (développement)
 *   npm run email:push -- --rate-limit=100      e-mails par heure (effectif avec un SMTP personnalisé)
 *
 * Prérequis : SUPABASE_ACCESS_TOKEN dans .env (jeton personnel : supabase.com/dashboard/account/tokens).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const env = readEnv(path.join(root, ".env"));
const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.includes("=") ? a.replace(/^--/, "").split(/=(.*)/s).slice(0, 2) : [a.replace(/^--/, ""), true])));

const token = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(/^https?:\/\/([a-z0-9]+)\./)?.[1];
if (!ref) fail("NEXT_PUBLIC_SUPABASE_URL est absent ou invalide dans .env.");
if (!token) {
  fail(
    [
      "SUPABASE_ACCESS_TOKEN est absent du fichier .env.",
      "1. Créez un jeton d’accès personnel : https://supabase.com/dashboard/account/tokens",
      "2. Ajoutez la ligne  SUPABASE_ACCESS_TOKEN=sbp_…  dans .env",
      "3. Relancez : npm run email:push",
    ].join("\n"),
  );
}

const templatesDir = path.join(root, "supabase", "email-templates");
const TEMPLATES = [
  { file: "confirm-signup.html", subject: "mailer_subjects_confirmation", content: "mailer_templates_confirmation_content", title: "Bienvenue sur Janngude : confirmez votre adresse" },
  { file: "reset-password.html", subject: "mailer_subjects_recovery", content: "mailer_templates_recovery_content", title: "Réinitialisez votre mot de passe Janngude" },
  { file: "change-email.html", subject: "mailer_subjects_email_change", content: "mailer_templates_email_change_content", title: "Confirmez votre nouvelle adresse Janngude" },
  { file: "magic-link.html", subject: "mailer_subjects_magic_link", content: "mailer_templates_magic_link_content", title: "Votre lien de connexion Janngude" },
];

const body = {};
for (const t of TEMPLATES) {
  const file = path.join(templatesDir, t.file);
  if (!fs.existsSync(file)) fail(`Modèle introuvable : ${file}`);
  body[t.subject] = t.title;
  body[t.content] = fs.readFileSync(file, "utf8");
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// Configuration actuelle (pour fusionner la liste des URL de redirection).
const current = await request("GET", api);

if (args["site-url"]) {
  const site = String(args["site-url"]).replace(/\/$/, "");
  const wanted = [`${site}/auth/**`, "http://localhost:*/auth/**"];
  const existing = String(current.uri_allow_list || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  body.site_url = site;
  body.uri_allow_list = Array.from(new Set([...existing, ...wanted])).join(",");
}

if (args.smtp) {
  const key = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM || "";
  const match = from.match(/^(?:(.*?)\s*<)?([^<>]+@[^<>]+?)>?\s*$/);
  if (!key) fail("--smtp : RESEND_API_KEY manquant dans .env.");
  if (!match) fail("--smtp : EMAIL_FROM manquant ou invalide dans .env (ex. Janngude <bonjour@votre-domaine>).");
  const address = match[2].trim();
  if (/resend\.dev$/i.test(address)) fail("--smtp : EMAIL_FROM doit être une adresse d’un domaine vérifié chez Resend (onboarding@resend.dev ne peut écrire qu’à votre propre adresse).");
  Object.assign(body, {
    external_email_enabled: true,
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: key,
    smtp_admin_email: address,
    smtp_sender_name: (match[1] || "Janngude").replace(/"/g, "").trim() || "Janngude",
  });
}

if (args.autoconfirm !== undefined) body.mailer_autoconfirm = String(args.autoconfirm) !== "off";
if (args["rate-limit"] !== undefined) {
  const n = Number(args["rate-limit"]);
  if (!Number.isInteger(n) || n <= 0) fail("--rate-limit attend un entier positif (e-mails par heure).");
  body.rate_limit_email_sent = n;
}

await request("PATCH", api, body);

console.log(`✓ Modèles installés sur le projet ${ref} :`);
for (const t of TEMPLATES) console.log(`  • ${t.file} → « ${t.title} »`);
if (body.site_url) console.log(`✓ Site URL : ${body.site_url}\n✓ Redirect URLs : ${body.uri_allow_list}`);
if (args.smtp) console.log(`✓ SMTP Resend configuré (expéditeur ${body.smtp_sender_name} <${body.smtp_admin_email}>)`);
if (body.mailer_autoconfirm !== undefined) console.log(body.mailer_autoconfirm ? "✓ Inscription sans confirmation d’e-mail (réservé au développement)" : "✓ Confirmation d’e-mail à l’inscription réactivée");
if (body.rate_limit_email_sent !== undefined) console.log(`✓ Limite d’envoi : ${body.rate_limit_email_sent} e-mails par heure`);
if (!args["site-url"]) {
  const list = String(current.uri_allow_list || "");
  if (!/auth\/(confirm|\*\*)/.test(list)) console.log("\n⚠ Les URL de redirection ne contiennent pas /auth/confirm : relancez avec --site-url=https://votre-domaine (ou ajoutez-les dans Authentication → URL Configuration).");
}

// ---------------------------------------------------------------------------
async function request(method, url, payload) {
  const res = await fetch(url, { method, headers, body: payload ? JSON.stringify(payload) : undefined });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${url} → ${res.status}\n${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
