import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;

export function anthropic() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 10 * 60 * 1000 });
  return client;
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Message d’erreur lisible pour l’utilisateur à partir d’une erreur SDK. */
export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Clé API Claude manquante ou invalide. Renseignez ANTHROPIC_API_KEY dans le fichier .env.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Le service d’analyse est momentanément saturé. Réessayez dans quelques instants.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return "Le document n’a pas pu être traité (format ou taille non pris en charge).";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Impossible de joindre le service d’analyse. Vérifiez votre connexion.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Erreur du service d’analyse (${error.status}).`;
  }
  if (error instanceof Error) return error.message;
  return "Une erreur inattendue est survenue.";
}

/** Récupère le texte d’une réponse (concatène les blocs texte). */
export function messageText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function assertNotRefused(message: Anthropic.Message) {
  if (message.stop_reason === "refusal") {
    throw new Error("La demande n’a pas pu être traitée par l’assistant.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("La réponse est trop longue pour être générée en une fois. Essayez avec un contenu plus court.");
  }
}
