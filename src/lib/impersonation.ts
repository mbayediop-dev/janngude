import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

/**
 * Connexion « en tant que » : un administrateur ouvre la session d’un étudiant dans son propre navigateur.
 * Un cookie signé (HMAC avec la clé secrète Supabase) mémorise qui est l’administrateur d’origine afin de
 * pouvoir revenir à son compte sans mot de passe. Le cookie n’a aucune valeur sans la signature.
 */
export const IMPERSONATION_COOKIE = "janngude_admin_session";
/** Durée maximale d’une consultation « en tant que » ; au-delà, l’administrateur se reconnecte normalement. */
const MAX_AGE_SECONDS = 4 * 60 * 60;

export type Impersonation = { adminId: string; targetId: string; exp: number };

function secret() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new Error("SUPABASE_SECRET_KEY manquante.");
  return key;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeImpersonation(data: Impersonation) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeImpersonation(value: string | undefined, now = Date.now()): Impersonation | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Impersonation>;
    if (typeof data.adminId !== "string" || typeof data.targetId !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 < now) return null;
    return { adminId: data.adminId, targetId: data.targetId, exp: data.exp };
  } catch {
    return null;
  }
}

/** Lit le cookie signé d’une session ouverte « en tant que » (null s’il est absent, altéré ou expiré). */
export async function readImpersonation(): Promise<Impersonation | null> {
  await connection(); // rendu dynamique explicite : Date.now() est utilisé pour l’expiration
  const store = await cookies();
  return decodeImpersonation(store.get(IMPERSONATION_COOKIE)?.value);
}

/** À appeler depuis une route API (les cookies sont en lecture seule dans les Server Components). */
export async function setImpersonationCookie(data: Omit<Impersonation, "exp">) {
  const store = await cookies();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  store.set(IMPERSONATION_COOKIE, encodeImpersonation({ ...data, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearImpersonationCookie() {
  const store = await cookies();
  store.delete({ name: IMPERSONATION_COOKIE, path: "/" });
}

/**
 * Ouvre, dans le navigateur courant, la session de l’utilisateur dont on donne l’adresse : lien magique
 * généré côté serveur (clé secrète) puis vérifié aussitôt, sans envoi d’e-mail. Remplace la session en cours.
 */
export async function signInAs(supabase: SupabaseClient<Database>, email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`Impossible d’ouvrir la session (${error.message}).`);
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (verifyError) throw new Error(`Impossible d’ouvrir la session (${verifyError.message}).`);
}
