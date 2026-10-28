import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

/** Enregistre une consommation (caractères IA, caractères de synthèse vocale…) pour le suivi administrateur. Jamais bloquant. */
export async function logUsage(supabase: SupabaseClient<Database>, userId: string, kind: string, units: number, meta?: Record<string, unknown>) {
  try {
    await supabase.from("usage_events").insert({ user_id: userId, kind, units: Math.max(0, Math.round(units)), meta: (meta ?? null) as Json | null });
  } catch {
    /* le suivi d’usage ne doit jamais faire échouer l’action */
  }
}
