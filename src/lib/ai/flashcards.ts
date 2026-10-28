import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { ASSISTANT_IDENTITY } from "./prompts";

export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});

const SYSTEM_FLASHCARDS = `${ASSISTANT_IDENTITY}

Ta tâche : créer des cartes mémoire (question / réponse) pour mémoriser un cours par répétition espacée.

Règles :
- "front" : une question précise, ou une notion à définir, ou un début de phrase à compléter. Courte (une ligne).
- "back" : la réponse exacte issue du cours, en 1 à 3 phrases, avec le chiffre, la définition ou la règle attendus.
- Une seule idée par carte. Couvre tout le cours : définitions, formules, dates, règles, exceptions, étapes.
- Varie les formes (question directe, « Complétez : … », « Vrai ou faux ? … » avec justification).
- N’invente rien qui ne soit pas dans le cours.`;

export async function generateFlashcards(input: { text: string; title: string; domain: string; subject: string; count: number; existing?: string[] }) {
  const client = anthropic();
  const count = Math.max(5, Math.min(60, input.count));
  const avoid = input.existing?.length ? `\n\nCartes déjà existantes (ne les répète pas) :\n${input.existing.slice(0, 80).map((f) => `- ${f}`).join("\n")}` : "";
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_FLASHCARDS,
    messages: [
      {
        role: "user",
        content: `Cours : ${input.title}\nFormation : ${input.domain} — Matière : ${input.subject}\n\nNombre de cartes : exactement ${count}.${avoid}\n\n<cours>\n${input.text}\n</cours>`,
      },
    ],
    output_config: { effort: "medium", format: zodOutputFormat(FlashcardsSchema) },
  });
  const message = await stream.finalMessage();
  assertNotRefused(message);
  const parsed = FlashcardsSchema.parse(JSON.parse(messageText(message)));
  return parsed.cards.filter((c) => c.front.trim() && c.back.trim()).slice(0, count);
}
