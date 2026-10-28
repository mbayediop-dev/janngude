import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { SYSTEM_QUIZ, QUIZ_DIFFICULTY_INSTRUCTIONS } from "./prompts";
import type { QuizDifficulty } from "@/lib/supabase/types";

export const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      answer_index: z.number(),
      explanation: z.string(),
    }),
  ),
});

export type GeneratedQuiz = z.infer<typeof QuizSchema>;

export async function generateQuiz(input: {
  text: string;
  title: string;
  domain: string;
  subject: string;
  count: number;
  difficulty: QuizDifficulty;
  focus?: string;
}): Promise<GeneratedQuiz> {
  const client = anthropic();
  const count = Math.max(3, Math.min(30, input.count));
  const instructions = [
    `Nombre de questions : exactement ${count}.`,
    QUIZ_DIFFICULTY_INSTRUCTIONS[input.difficulty],
    input.focus ? `Thème à privilégier : ${input.focus}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_QUIZ,
    messages: [
      {
        role: "user",
        content: `Cours : ${input.title}\nFormation : ${input.domain} — Matière : ${input.subject}\n\n${instructions}\n\n<cours>\n${input.text}\n</cours>`,
      },
    ],
    output_config: { effort: "high", format: zodOutputFormat(QuizSchema) },
  });

  const message = await stream.finalMessage();
  assertNotRefused(message);
  const quiz = QuizSchema.parse(JSON.parse(messageText(message)));

  // Garde-fous : 4 options, index valide.
  quiz.questions = quiz.questions
    .filter((q) => q.options.length >= 2)
    .map((q) => ({
      ...q,
      options: q.options.slice(0, 4),
      answer_index: Math.max(0, Math.min(q.options.slice(0, 4).length - 1, Math.round(q.answer_index))),
    }))
    .slice(0, count);

  return quiz;
}
