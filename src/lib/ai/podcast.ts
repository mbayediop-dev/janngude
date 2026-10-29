import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { SYSTEM_PODCAST, NARRATION_LANGUAGE_INSTRUCTIONS } from "./prompts";
import { podcastBudget, PODCAST_INPUT_MAX_CHARS } from "@/lib/podcast-budget";
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

/** Garantit que le dialogue reste sous `maxChars` : retire, si besoin, les dernières répliques des sections les plus longues (jamais la première réplique d’une section). */
export function fitPodcast(podcast: Podcast, maxChars: number): Podcast {
  const sections = podcast.sections.map((s) => ({ title: s.title, lines: s.lines.filter((l) => l.text.trim()) })).filter((s) => s.lines.length);
  const size = (s: { lines: { text: string }[] }) => s.lines.reduce((n, l) => n + l.text.length, 0);
  let total = sections.reduce((n, s) => n + size(s), 0);
  while (total > maxChars) {
    const candidates = sections.filter((s) => s.lines.length > 1);
    if (!candidates.length) break;
    const longest = candidates.reduce((a, b) => (size(a) >= size(b) ? a : b));
    const removed = longest.lines[longest.lines.length - 1];
    longest.lines = longest.lines.slice(0, -1);
    total -= removed.text.length;
  }
  return { sections };
}

/**
 * Écrit un dialogue pédagogique à deux voix (enseignant / étudiant) à partir du cours.
 * La longueur du dialogue est bornée par `podcastBudget` (bien sous `maxChars`, la limite de synthèse vocale) :
 * un cours long est condensé, jamais refusé.
 */
export async function writePodcast(
  input: { text: string; title: string; domain: string; subject: string; language?: NarrationLanguage; maxChars: number },
  onProgress?: (fraction: number) => void,
): Promise<Podcast> {
  const client = anthropic();
  const budget = podcastBudget(input.text.length, input.maxChars);
  const source = input.text.length > PODCAST_INPUT_MAX_CHARS ? `${input.text.slice(0, PODCAST_INPUT_MAX_CHARS)}\n\n[Suite du cours omise : document trop long.]` : input.text;
  const lengthRule =
    `\n\nLongueur : le dialogue complet (toutes les répliques réunies) doit rester sous ${budget.target.toLocaleString("fr-FR")} caractères, soit environ ${budget.minutes} minutes d’écoute.` +
    (budget.condensed ? " Le cours est long : condense-le en gardant, pour chaque partie, les définitions, règles et exemples essentiels, plutôt que de tout reprendre." : "") +
    " Ne dépasse jamais ce budget.";
  const expected = Math.max(600, budget.target * 1.3);
  let produced = 0;
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_PODCAST + NARRATION_LANGUAGE_INSTRUCTIONS[input.language ?? "fr"] + lengthRule,
    messages: [
      {
        role: "user",
        content: `Cours : ${input.title}\nFormation : ${input.domain} — Matière : ${input.subject}\n\nTexte du cours à transformer en podcast :\n\n<texte>\n${source}\n</texte>`,
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
  return fitPodcast(PodcastSchema.parse(JSON.parse(messageText(message))), budget.hard);
}
