import "server-only";
import { anthropic, MODEL } from "./client";
import { SYSTEM_SUMMARY, SUMMARY_LENGTH_INSTRUCTIONS } from "./prompts";
import type { SummaryLength } from "@/lib/supabase/types";

export function streamSummary(input: { text: string; title: string; domain: string; subject: string; length: SummaryLength; focus?: string }) {
  const client = anthropic();
  const instructions = [
    SUMMARY_LENGTH_INSTRUCTIONS[input.length],
    input.focus ? `Consigne particulière de l’étudiant : ${input.focus}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_SUMMARY,
    messages: [
      {
        role: "user",
        content: `Cours : ${input.title}\nFormation : ${input.domain} — Matière : ${input.subject}\n\n${instructions}\n\n<cours>\n${input.text}\n</cours>`,
      },
    ],
    output_config: { effort: "medium" },
  });
}
