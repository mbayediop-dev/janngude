import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";

async function requireAdminApi() {
  const ctx = await requireApiUser();
  const { data: isAdmin } = await ctx.supabase.rpc("is_admin");
  if (!isAdmin) throw new ApiError("Réservé aux administrateurs.", 403);
  return ctx;
}

/** Change le rôle d’un utilisateur (student | admin). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireAdminApi();
    const body = await readJsonBody<{ role?: string }>(req);
    if (body.role !== "student" && body.role !== "admin") throw new ApiError("Rôle invalide.");
    if (id === user.id && body.role !== "admin") throw new ApiError("Vous ne pouvez pas retirer votre propre rôle d’administrateur.");
    const { error } = await supabase.rpc("admin_set_role", { p_user: id, p_role: body.role });
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Supprime un compte et toutes ses données (clé secrète Supabase requise). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    const { id } = await ctx.params;
    const { user } = await requireAdminApi();
    if (id === user.id) throw new ApiError("Vous ne pouvez pas supprimer votre propre compte depuis l’administration.");
    if (!adminConfigured()) return jsonError("Suppression indisponible : définissez SUPABASE_SECRET_KEY.", 503);
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
