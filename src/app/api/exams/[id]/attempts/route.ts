import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import type { GradeResult } from "@/lib/supabase/types";

export async function POST(req: Request, ctx: RouteContext<"/api/exams/[id]/attempts">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ answers?: (number | null)[]; timeSpentSeconds?: number }>(req);
    const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : null)) : [];
    const { data: exam } = await supabase.from("exams").select("id,questions").eq("id", id).maybeSingle();
    if (!exam) return jsonError("Examen introuvable.", 404);

    const results: GradeResult["results"] = exam.questions.map((q, i) => {
      const selected = answers[i] ?? null;
      return { index: i, selected, answer_index: q.answer_index, correct: selected === q.answer_index, explanation: q.explanation };
    });
    const score = results.filter((r) => r.correct).length;
    const total = results.length;
    const timeSpent = Math.max(0, Math.min(24 * 3600, Math.round(Number(body.timeSpentSeconds) || 0)));
    const { error } = await supabase.from("exam_attempts").insert({ exam_id: exam.id, user_id: user.id, answers, score, total, time_spent_seconds: timeSpent });
    if (error) throw new ApiError(error.message, 500);

    const byCourse: Record<string, { title: string; score: number; total: number }> = {};
    exam.questions.forEach((q, i) => {
      byCourse[q.course_id] ??= { title: q.course_title, score: 0, total: 0 };
      byCourse[q.course_id].total += 1;
      if (results[i].correct) byCourse[q.course_id].score += 1;
    });
    return Response.json({ score, total, results, byCourse });
  } catch (e) {
    return handleApiError(e);
  }
}
