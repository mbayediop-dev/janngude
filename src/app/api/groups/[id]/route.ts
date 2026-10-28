import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";

/** Renomme un groupe (propriétaire uniquement). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/groups/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ name?: string }>(req);
    const name = (body.name ?? "").trim().slice(0, 80);
    if (name.length < 2) throw new ApiError("Nom trop court.");
    const { data, error } = await supabase.from("groups").update({ name }).eq("id", id).eq("owner_id", user.id).select("id");
    if (error) throw new ApiError(error.message, 500);
    if (!data?.length) return jsonError("Seul le créateur du groupe peut le renommer.", 403);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Le propriétaire supprime le groupe ; un membre le quitte. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/groups/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const { data: group } = await supabase.from("groups").select("id,owner_id").eq("id", id).maybeSingle();
    if (!group) return jsonError("Groupe introuvable.", 404);
    if (group.owner_id === user.id) {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw new ApiError(error.message, 500);
      return Response.json({ ok: true, deleted: true });
    }
    const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", user.id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true, left: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Retire un membre (propriétaire uniquement). */
export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ action?: "remove"; userId?: string }>(req);
    if (body.action !== "remove" || !body.userId) throw new ApiError("Action inconnue.");
    const { data: group } = await supabase.from("groups").select("id,owner_id").eq("id", id).maybeSingle();
    if (!group) return jsonError("Groupe introuvable.", 404);
    if (group.owner_id !== user.id) return jsonError("Seul le créateur du groupe peut retirer un membre.", 403);
    if (body.userId === user.id) throw new ApiError("Le créateur ne peut pas se retirer : supprimez le groupe.");
    const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", body.userId);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
