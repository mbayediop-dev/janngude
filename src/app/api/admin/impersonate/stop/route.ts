import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { clearImpersonationCookie, readImpersonation, signInAs } from "@/lib/impersonation";

/**
 * Quitte la session ouverte « en tant que » et rouvre celle de l’administrateur (formulaire du bandeau).
 * Si le cookie signé manque, est expiré ou ne correspond plus à la session courante, on déconnecte
 * proprement et l’administrateur se reconnecte avec son mot de passe.
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const session = await readImpersonation();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fail = async () => {
    await clearImpersonationCookie();
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=session_admin`, { status: 303 });
  };

  if (!session || !adminConfigured() || !user || user.id !== session.targetId) return fail();

  const admin = createAdminClient();
  const [{ data: adminUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(session.adminId),
    admin.from("profiles").select("role").eq("id", session.adminId).maybeSingle(),
  ]);
  const email = adminUser?.user?.email;
  if (!email || profile?.role !== "admin") return fail();

  try {
    await signInAs(supabase, email);
  } catch {
    return fail();
  }
  await clearImpersonationCookie();
  return NextResponse.redirect(`${origin}/admin`, { status: 303 });
}
