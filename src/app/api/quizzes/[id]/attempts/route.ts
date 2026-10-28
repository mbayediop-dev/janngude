import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import type { GradeResult } from "@/lib/supabase/types";

export async function POST(req: Request, ctx: RouteContext<"/api/quizzes/[id]/attempts">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ answers?: (number | null)[] }>(req);
    const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : null)) : [];

    const { data: quiz } = await supabase.from("quizzes").select("id,questions").eq("id", id).maybeSingle();
    if (!quiz) return jsonError("Quiz introuvable.", 404);

    const results: GradeResult["results"] = quiz.questions.map((q, i) => {
      const selected = answers[i] ?? null;
      return { index: i, selected, answer_index: q.answer_index, correct: selected === q.answer_index, explanation: q.explanation };
    });
    const score = results.filter((r) => r.correct).length;
    const total = results.length;

    const { error } = await supabase.from("quiz_attempts").insert({ quiz_id: quiz.id, user_id: user.id, answers, score, total });
    if (error) throw new ApiError(error.message, 500);

    const result: GradeResult = { score, total, results };
    return Response.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
