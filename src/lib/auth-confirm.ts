import "server-only";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/**
 * Traite un lien reçu par e-mail. Deux formats sont acceptés :
 *  - modèles personnalisés : `?token_hash=…&type=…` (vérification du jeton côté serveur, valable depuis n’importe quel navigateur) ;
 *  - modèles Supabase par défaut : `?code=…` (échange du code, valable dans le navigateur d’origine).
 */
export async function confirmFromEmailLink(request: Request, defaults: { next: string; type?: EmailOtpType; errorCode: string }) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? defaults.type ?? null;
  const nextParam = searchParams.get("next") ?? defaults.next;
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : defaults.next;

  const supabase = await createClient();
  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${defaults.errorCode}`);
}
