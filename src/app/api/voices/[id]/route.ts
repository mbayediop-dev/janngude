import { handleApiError, jsonError, requireApiUser, ApiError } from "@/lib/api";
import { deleteVoice } from "@/lib/tts";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/voices/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const { data: voice } = await supabase.from("voices").select("id,provider_voice_id,sample_path").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!voice) return jsonError("Voix introuvable.", 404);
    await deleteVoice(voice.provider_voice_id);
    if (voice.sample_path) await supabase.storage.from("voices").remove([voice.sample_path]);
    const { error } = await supabase.from("voices").delete().eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
