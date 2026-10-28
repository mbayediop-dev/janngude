import { connection } from "next/server";
import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/courses/[id]">) {
  await connection();
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { data } = await supabase.from("courses").select("status,error_message,title").eq("id", id).maybeSingle();
    if (!data) return jsonError("Cours introuvable.", 404);
    return Response.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/courses/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const body = await readJsonBody<{ title?: string; domain?: string; subject?: string }>(req);
    const patch: { title?: string; domain?: string; subject?: string } = {};
    if (body.title?.trim()) patch.title = body.title.trim().slice(0, 140);
    if (body.domain?.trim()) patch.domain = body.domain.trim().slice(0, 80);
    if (body.subject?.trim()) patch.subject = body.subject.trim().slice(0, 80);
    if (!Object.keys(patch).length) throw new ApiError("Rien à modifier.");
    const { error } = await supabase.from("courses").update(patch).eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/courses/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { data: course } = await supabase.from("courses").select("id,file_path").eq("id", id).maybeSingle();
    if (!course) return jsonError("Cours introuvable.", 404);

    const { data: audios } = await supabase.from("audio_readings").select("file_path").eq("course_id", id);
    if (audios?.length) await supabase.storage.from("audio").remove(audios.flatMap((a) => [a.file_path, a.file_path.replace(/\.mp3$/, ".json")]));
    if (course.file_path) await supabase.storage.from("courses").remove([course.file_path]);

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
