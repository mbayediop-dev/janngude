import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { generateFlashcards } from "@/lib/ai/flashcards";
import { describeAiError } from "@/lib/ai/client";
import { logUsage } from "@/lib/usage";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/courses/[id]/flashcards">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ count?: number }>(req);
    const count = Math.max(5, Math.min(60, Number(body.count) || 20));

    const { data: course } = await supabase.from("courses").select("id,title,domain,subject,content_text").eq("id", id).maybeSingle();
    if (!course || !course.content_text) return jsonError("Cours introuvable ou non analysé.", 404);
    const { data: existing } = await supabase.from("flashcards").select("front").eq("course_id", id);

    try {
      const cards = await generateFlashcards({ text: course.content_text, title: course.title, domain: course.domain, subject: course.subject, count, existing: (existing ?? []).map((c) => c.front) });
      if (!cards.length) throw new Error("Aucune carte n’a pu être générée.");
      const { data: rows, error } = await supabase
        .from("flashcards")
        .insert(cards.map((c) => ({ course_id: course.id, user_id: user.id, front: c.front.trim(), back: c.back.trim() })))
        .select("*");
      if (error) throw new ApiError(error.message, 500);
      await logUsage(supabase, user.id, "ai_flashcards_chars", course.content_text.length, { course_id: id, cards: cards.length });
      return Response.json({ cards: rows ?? [] });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return jsonError(describeAiError(error), 500);
    }
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/courses/[id]/flashcards">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { error } = await supabase.from("flashcards").delete().eq("course_id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
