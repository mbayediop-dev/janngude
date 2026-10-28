import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { generateQuiz } from "@/lib/ai/quiz";
import { describeAiError } from "@/lib/ai/client";
import { logUsage } from "@/lib/usage";
import type { ExamQuestion, QuizDifficulty } from "@/lib/supabase/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ courseIds?: string[]; count?: number; durationMinutes?: number; difficulty?: QuizDifficulty; title?: string }>(req);
    const courseIds = Array.from(new Set((body.courseIds ?? []).filter((x) => typeof x === "string"))).slice(0, 8);
    if (!courseIds.length) throw new ApiError("Choisissez au moins un cours.");
    const total = Math.max(5, Math.min(60, Number(body.count) || 20));
    const duration = Math.max(5, Math.min(240, Number(body.durationMinutes) || 30));
    const difficulty: QuizDifficulty = (["easy", "medium", "hard"] as const).includes(body.difficulty ?? "medium") ? (body.difficulty ?? "medium") : "medium";

    const { data: courses } = await supabase.from("courses").select("id,title,domain,subject,content_text").in("id", courseIds).eq("status", "ready");
    if (!courses?.length) return jsonError("Cours introuvables ou non analysés.", 404);

    // Répartition des questions entre les cours, génération en parallèle.
    const perCourse = Math.max(2, Math.ceil(total / courses.length));
    try {
      const generated = await Promise.all(
        courses.map(async (c) => {
          const quiz = await generateQuiz({ text: c.content_text ?? "", title: c.title, domain: c.domain, subject: c.subject, count: perCourse, difficulty });
          return quiz.questions.map((q): ExamQuestion => ({ ...q, course_id: c.id, course_title: c.title }));
        }),
      );
      const questions = interleave(generated).slice(0, total);
      if (!questions.length) throw new Error("Aucune question n’a pu être générée.");
      const title = body.title?.trim().slice(0, 140) || `Examen blanc — ${courses.length === 1 ? courses[0].title : courses[0].subject}`;
      const { data: exam, error } = await supabase
        .from("exams")
        .insert({ user_id: user.id, title, course_ids: courses.map((c) => c.id), questions, duration_minutes: duration })
        .select("*")
        .single();
      if (error) throw new ApiError(error.message, 500);
      await logUsage(supabase, user.id, "ai_exam_chars", courses.reduce((s, c) => s + (c.content_text?.length ?? 0), 0), { exam_id: exam.id, questions: questions.length });
      return Response.json(exam);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return jsonError(describeAiError(error), 500);
    }
  } catch (e) {
    return handleApiError(e);
  }
}

/** Alterne les questions de chaque cours pour mélanger les sujets. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}
