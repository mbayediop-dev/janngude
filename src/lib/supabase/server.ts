import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./types";

/**
 * Client Supabase côté serveur (Server Components, Route Handlers, Server Actions).
 * Lit la session depuis les cookies : à appeler uniquement dans un sous-arbre dynamique (Suspense).
 * `connection()` marque explicitement le rendu comme dynamique : supabase-js appelle `Date.now()`
 * en interne, ce que Cache Components interdit pendant la pré-génération et le préchargement.
 */
export async function createClient() {
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un Server Component : le proxy rafraîchit la session.
          }
        },
      },
    },
  );
}
