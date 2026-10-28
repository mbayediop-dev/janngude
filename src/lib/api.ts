import "server-only";
import { createClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Retourne le client Supabase lié à la session et l’utilisateur connecté, ou lève une ApiError 401. */
export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Connexion requise.", 401);
  return { supabase, user };
}

function isNextInternalError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_");
}

export function handleApiError(error: unknown) {
  if (isNextInternalError(error)) throw error;
  if (error instanceof ApiError) return jsonError(error.message, error.status);
  console.error(error);
  return jsonError(error instanceof Error ? error.message : "Erreur interne.", 500);
}

/** Flux NDJSON : chaque ligne est un objet JSON. */
export function ndjsonResponse(run: (emit: (event: Record<string, unknown>) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await run(emit);
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : "Erreur inattendue." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Corps de requête invalide.");
  }
}
