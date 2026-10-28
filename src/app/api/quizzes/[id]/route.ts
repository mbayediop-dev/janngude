import { handleApiError, requireApiUser, ApiError } from "@/lib/api";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
