import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function secretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/** Vrai si la clé secrète Supabase est configurée (génération de liens d’authentification côté serveur). */
export function adminConfigured() {
  return secretKey().length > 0;
}

/**
 * Client d’administration (clé secrète, contourne la RLS). À n’utiliser que dans des routes serveur
 * pour des opérations précises : ici, générer les liens d’e-mail d’authentification.
 */
export function createAdminClient() {
  if (!adminConfigured()) throw new Error("SUPABASE_SECRET_KEY manquante.");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
