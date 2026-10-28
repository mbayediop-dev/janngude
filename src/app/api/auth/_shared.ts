import "server-only";
import { jsonError } from "@/lib/api";
import { adminConfigured } from "@/lib/supabase/admin";
import { emailConfigured } from "@/lib/email";
import { rateLimited } from "@/lib/rate-limit";
import { AuthMailError } from "@/lib/auth-mail";
import { appUrl } from "@/lib/utils";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 503 si l’envoi applicatif n’est pas configuré : le client retombe alors sur l’envoi Supabase. */
export function requireAppMail() {
  if (!adminConfigured() || !emailConfigured()) return jsonError("Envoi applicatif non configuré.", 503);
  return null;
}

export function originOf(request: Request) {
  const origin = request.headers.get("origin");
  return origin && /^https?:\/\//.test(origin) ? origin : appUrl();
}

export function throttle(request: Request, action: string, email: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return rateLimited(`${action}:${ip}:${email.toLowerCase()}`, 5);
}

export function authMailErrorResponse(error: unknown) {
  if (error instanceof AuthMailError) return jsonError(error.message, error.status);
  console.error(error);
  return jsonError("Une erreur est survenue lors de l’envoi de l’e-mail.", 500);
}
