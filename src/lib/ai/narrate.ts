import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { SYSTEM_NARRATE, NARRATION_LANGUAGE_INSTRUCTIONS } from "./prompts";
import type { NarrationLanguage } from "@/lib/supabase/types";

export const NarrationSchema = z.object({
  sections: z.array(z.object({ title: z.string(), paragraphs: z.array(z.string()) })),
});

export type Narration = z.infer<typeof NarrationSchema>;

/** Réécrit un texte de cours en script de narration structuré en sections (pauses, respirations, transitions orales). */
export async function narrateForSpeech(
  input: { text: string; title: string; domain: string; subject: string; language?: NarrationLanguage },
  onProgress?: (fraction: number) => void,
): Promise<Narration> {
  const client = anthropic();
  const expected = Math.max(500, input.text.length * 1.15);
  let produced = 0;
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_NARRATE + NARRATION_LANGUAGE_INSTRUCTIONS[input.language ?? "fr"],
    messages: [
      {
        role: "user",
        content: `Cours : ${input.title}\nFormation : ${input.domain} — Matière : ${input.subject}\n\nTexte à transformer en script de lecture :\n\n<texte>\n${input.text}\n</texte>`,
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(NarrationSchema) },
  });
  if (onProgress) {
    stream.on("text", (delta) => {
      produced += delta.length;
      onProgress(Math.min(0.97, produced / expected));
    });
  }
  const message = await stream.finalMessage();
  assertNotRefused(message);
  return NarrationSchema.parse(JSON.parse(messageText(message)));
}
