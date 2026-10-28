import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { SYSTEM_PODCAST, NARRATION_LANGUAGE_INSTRUCTIONS } from "./prompts";
import type { NarrationLanguage } from "@/lib/supabase/types";

export const PodcastSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      lines: z.array(z.object({ speaker: z.enum(["host", "guest"]), text: z.string() })),
    }),
  ),
});

export type Podcast = z.infer<typeof PodcastSchema>;

/** Écrit un dialogue pédagogique à deux voix (enseignant / étudiant) à partir du cours. */
export async function writePodcast(
  input: { text: string; title: string; domain: string; subject: string; language?: NarrationLanguage },
  onProgress?: (fraction: number) => void,
): Promise<Podcast> {
  const client = anthropic();
  const expected = Math.max(600, input.text.length * 1.3);
  let produced = 0;
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_PODCAST + NARRATION_LANGUAGE_INSTRUCTIONS[input.language ?? "fr"],
    messages: [
      {
        role: "user",
        content: `Cours : ${input.title}\nFormation : ${input.domain} — Matière : ${input.subject}\n\nTexte du cours à transformer en podcast :\n\n<texte>\n${input.text}\n</texte>`,
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(PodcastSchema) },
  });
  if (onProgress) {
    stream.on("text", (delta) => {
      produced += delta.length;
      onProgress(Math.min(0.97, produced / expected));
    });
  }
  const message = await stream.finalMessage();
  assertNotRefused(message);
  return PodcastSchema.parse(JSON.parse(messageText(message)));
}
