import { handleApiError, jsonError, requireApiUser } from "@/lib/api";
import { analyzeCourse } from "@/lib/ai/analyze";
import { describeAiError } from "@/lib/ai/client";
import { logUsage } from "@/lib/usage";
import { extractText, countWords } from "@/lib/extract";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/courses/[id]/analyze">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = (await req.json().catch(() => ({}))) as { autoTitle?: boolean };

    const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
    if (!course) return jsonError("Cours introuvable.", 404);
    if (course.status === "processing") return Response.json({ ok: true, status: "processing" });

    await supabase.from("courses").update({ status: "processing", error_message: null }).eq("id", id);

    try {
      let text = course.content_text ?? "";
      if (!text) {
        if (!course.file_path) throw new Error("Aucun fichier associé à ce cours.");
        const { data: blob, error } = await supabase.storage.from("courses").download(course.file_path);
        if (error || !blob) throw new Error("Impossible de lire le fichier déposé.");
        const buffer = Buffer.from(await blob.arrayBuffer());
        const extraction = await extractText(buffer, course.file_type ?? "", course.file_name ?? "");
        text = extraction.text;
        if (extraction.method === "transcription") await logUsage(supabase, user.id, (course.file_type ?? "").startsWith("audio/") || course.file_type === "video/mp4" ? "stt_bytes" : "ai_ocr_bytes", buffer.length, { course_id: id });
      }
      if (text.length < 80) throw new Error("Le document ne contient pas assez de texte exploitable.");

      const analysis = await analyzeCourse({ text, title: body.autoTitle ? undefined : course.title, domain: course.domain, subject: course.subject });
      await logUsage(supabase, user.id, "ai_analysis_chars", text.length, { course_id: id });

      const { error: updateError } = await supabase
        .from("courses")
        .update({
          status: "ready",
          content_text: text,
          title: body.autoTitle && analysis.title ? analysis.title.slice(0, 140) : course.title,
          overview: analysis.overview,
          outline: analysis.outline,
          key_points: analysis.key_points,
          keywords: analysis.keywords,
          word_count: countWords(text),
          error_message: null,
        })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);

      return Response.json({ ok: true, status: "ready" });
    } catch (error) {
      const message = describeAiError(error);
      await supabase.from("courses").update({ status: "error", error_message: message }).eq("id", id);
      return jsonError(message, 500);
    }
  } catch (e) {
    return handleApiError(e);
  }
}
