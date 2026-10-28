import { handleApiError, requireApiUser, ApiError } from "@/lib/api";
import { logUsage } from "@/lib/usage";

/** Copie un cours partagé (lien public) dans l’espace de l’utilisateur connecté. */
export async function POST(_req: Request, ctx: RouteContext<"/api/shares/[token]/copy">) {
  try {
    const { token } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const { data: id, error } = await supabase.rpc("copy_shared_course", { p_token: token });
    if (error) {
      if (/share_not_found|course_not_found/.test(error.message)) throw new ApiError("Ce partage n’existe plus.", 404);
      throw new ApiError(error.message, 500);
    }
    await logUsage(supabase, user.id, "course_copied", 1, { course_id: id, token });
    return Response.json({ id });
  } catch (e) {
    return handleApiError(e);
  }
}
