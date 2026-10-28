import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { SYSTEM_ANALYZE } from "./prompts";

export const AnalysisSchema = z.object({
  title: z.string(),
  overview: z.string(),
  outline: z.array(z.object({ title: z.string(), points: z.array(z.string()) })),
  key_points: z.array(z.object({ title: z.string(), detail: z.string() })),
  keywords: z.array(z.string()),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

export async function analyzeCourse(input: { text: string; title?: string; domain: string; subject: string }): Promise<Analysis> {
  const client = anthropic();
  const context = `Formation : ${input.domain}\nMatière : ${input.subject}\nTitre donné par l’étudiant : ${input.title ?? "(aucun)"}\n\n<cours>\n${input.text}\n</cours>`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_ANALYZE,
    messages: [{ role: "user", content: context }],
    output_config: { effort: "high", format: zodOutputFormat(AnalysisSchema) },
  });

  const message = await stream.finalMessage();
  assertNotRefused(message);
  return AnalysisSchema.parse(JSON.parse(messageText(message)));
}
