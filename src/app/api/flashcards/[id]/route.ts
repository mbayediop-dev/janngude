import { handleApiError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";

export async function PATCH(req: Request, ctx: RouteContext<"/api/flashcards/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const body = await readJsonBody<{ front?: string; back?: string }>(req);
    const patch: { front?: string; back?: string } = {};
    if (body.front?.trim()) patch.front = body.front.trim().slice(0, 500);
    if (body.back?.trim()) patch.back = body.back.trim().slice(0, 2000);
    if (!Object.keys(patch).length) throw new ApiError("Rien à modifier.");
    const { error } = await supabase.from("flashcards").update(patch).eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/flashcards/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
