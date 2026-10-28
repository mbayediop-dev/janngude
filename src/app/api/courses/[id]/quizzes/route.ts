import { handleApiError, jsonError, readJsonBody, requireApiUser } from "@/lib/api";
import { generateQuiz } from "@/lib/ai/quiz";
import { describeAiError } from "@/lib/ai/client";
import { logUsage } from "@/lib/usage";
import type { QuizDifficulty } from "@/lib/supabase/types";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/courses/[id]/quizzes">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ count?: number; difficulty?: QuizDifficulty; focus?: string }>(req);
    const difficulty: QuizDifficulty = (["easy", "medium", "hard"] as const).includes(body.difficulty ?? "medium") ? (body.difficulty ?? "medium") : "medium";
    const count = Math.max(3, Math.min(30, Number(body.count) || 10));

    const { data: course } = await supabase.from("courses").select("id,title,domain,subject,content_text").eq("id", id).maybeSingle();
    if (!course || !course.content_text) return jsonError("Cours introuvable ou non analysé.", 404);

    try {
      const quiz = await generateQuiz({ text: course.content_text, title: course.title, domain: course.domain, subject: course.subject, count, difficulty, focus: body.focus?.slice(0, 200) });
      if (!quiz.questions.length) throw new Error("Aucune question n’a pu être générée.");
      await logUsage(supabase, user.id, "ai_quiz_chars", course.content_text.length, { course_id: id });
      const { data: row, error } = await supabase
        .from("quizzes")
        .insert({ course_id: course.id, user_id: user.id, title: quiz.title.slice(0, 140), difficulty, questions: quiz.questions })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return Response.json(row);
    } catch (error) {
      return jsonError(describeAiError(error), 500);
    }
  } catch (e) {
    return handleApiError(e);
  }
}
