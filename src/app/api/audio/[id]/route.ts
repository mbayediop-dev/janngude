import { handleApiError, jsonError, requireApiUser, ApiError } from "@/lib/api";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/audio/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { data: row } = await supabase.from("audio_readings").select("id,file_path").eq("id", id).maybeSingle();
    if (!row) return jsonError("Lecture introuvable.", 404);
    await supabase.storage.from("audio").remove([row.file_path, row.file_path.replace(/\.mp3$/, ".json")]);
    const { error } = await supabase.from("audio_readings").delete().eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
