import { handleApiError, requireApiUser, ApiError } from "@/lib/api";
import { logUsage } from "@/lib/usage";

/** Reprend une discussion partagée dans l’espace de l’utilisateur connecté (cours copié si besoin) pour poser ses propres questions. */
export async function POST(_req: Request, ctx: RouteContext<"/api/shares/[token]/continue">) {
  try {
    const { token } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const { data, error } = await supabase.rpc("continue_shared_chat", { p_token: token });
    if (error) {
      if (/share_not_found|chat_not_found|course_not_found/.test(error.message)) throw new ApiError("Ce partage n’existe plus.", 404);
      if (/continue_shared_chat/.test(error.message)) throw new ApiError("Fonction indisponible : appliquez la migration 0006.", 500);
      throw new ApiError(error.message, 500);
    }
    const result = data as { course_id: string; chat_id: string; created: boolean };
    if (result.created) await logUsage(supabase, user.id, "chat_continued", 1, { course_id: result.course_id, chat_id: result.chat_id, token });
    return Response.json({ courseId: result.course_id, chatId: result.chat_id, created: result.created });
  } catch (e) {
    return handleApiError(e);
  }
}
