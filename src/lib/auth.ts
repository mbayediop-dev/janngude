import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "student" | "admin";
  phone: string | null;
};

/** Lit la session (cookies) : à appeler uniquement derrière une frontière <Suspense>. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const p = profile as ProfileRow | null;
  const metaName = (user.user_metadata?.full_name as string | undefined) ?? null;

  return {
    id: user.id,
    email: user.email ?? "",
    name: p?.full_name || metaName || user.email?.split("@")[0] || "Étudiant",
    avatarUrl: p?.avatar_url ?? null,
    role: p?.role ?? "student",
    phone: p?.phone ?? null,
  };
}

export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/app");
  return user;
}
