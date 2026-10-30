import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireApiAdmin } from "@/lib/api";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { setImpersonationCookie, signInAs } from "@/lib/impersonation";
import { logUsage } from "@/lib/usage";

/** Ouvre la session d’un compte dans le navigateur de l’administrateur ; un bandeau permet ensuite de revenir. */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/users/[id]/impersonate">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiAdmin();
    if (id === user.id) throw new ApiError("Vous êtes déjà connecté à ce compte.");
    if (!adminConfigured()) throw new ApiError("Connexion indisponible : définissez SUPABASE_SECRET_KEY.", 503);
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(id);
    const email = data?.user?.email;
    if (error || !email) throw new ApiError("Compte introuvable.", 404);
    // Trace côté administrateur (avant le changement de session, pour que la ligne lui soit attribuée).
    await logUsage(supabase, user.id, "admin_impersonation", 1, { target: id, email });
    await signInAs(supabase, email);
    await setImpersonationCookie({ adminId: user.id, targetId: id });
    return NextResponse.json({ ok: true, redirect: "/app" });
  } catch (e) {
    return handleApiError(e);
  }
}
