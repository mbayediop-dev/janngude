import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./client";
import { SYSTEM_CHAT } from "./prompts";
import type { ChatRole } from "@/lib/supabase/types";

export function streamChat(input: {
  course: { title: string; domain: string; subject: string; text: string };
  history: { role: ChatRole; content: string }[];
  message: string;
}) {
  const client = anthropic();

  const messages: Anthropic.MessageParam[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    { role: "user", content: input.message },
  ];

  return client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    system: [
      { type: "text", text: SYSTEM_CHAT },
      {
        type: "text",
        text: `Cours : ${input.course.title}\nFormation : ${input.course.domain} — Matière : ${input.course.subject}\n\n<cours>\n${input.course.text}\n</cours>`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
    output_config: { effort: "medium" },
  });
}
