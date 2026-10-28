import "server-only";
import { anthropic, MODEL, messageText, assertNotRefused } from "./client";
import { SYSTEM_TRANSCRIBE } from "./prompts";

type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** Transcrit un PDF scanné ou une image (photo de notes) en Markdown via Claude. */
export async function transcribeDocument(buffer: Buffer, mime: string): Promise<string> {
  const client = anthropic();
  const data = buffer.toString("base64");

  const block =
    mime === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: mime as ImageMedia, data } } as const);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: SYSTEM_TRANSCRIBE,
    messages: [{ role: "user", content: [block, { type: "text", text: "Transcris l’intégralité de ce document." }] }],
    output_config: { effort: "low" },
  });

  const message = await stream.finalMessage();
  assertNotRefused(message);
  return messageText(message).trim();
}
