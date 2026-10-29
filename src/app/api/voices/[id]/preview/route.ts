import { connection } from "next/server";
import { handleApiError, jsonError, requireApiUser, ApiError } from "@/lib/api";
import { defaultVoiceId, ttsConfigured, voicePreview } from "@/lib/tts";
import { logUsage } from "@/lib/usage";

/**
 * Extrait d’écoute d’une voix (MP3) : `default` pour la voix par défaut, sinon l’identifiant d’une voix de l’étudiant.
 * L’extrait est mis en cache dans le bucket privé `voices` (`<user>/previews/<id>.mp3`) : ElevenLabs n’est sollicité qu’une fois.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/voices/[id]/preview">) {
  try {
    await connection();
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    if (!ttsConfigured()) throw new ApiError("La lecture audio n’est pas configurée (NEXT_ILEVENLABS_KEY).", 503);

    let providerVoiceId = defaultVoiceId();
    if (id !== "default") {
      const { data: voice } = await supabase.from("voices").select("id,provider_voice_id").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!voice) return jsonError("Voix introuvable.", 404);
      providerVoiceId = voice.provider_voice_id;
    }
    const path = `${user.id}/previews/${id === "default" ? `default-${providerVoiceId}` : id}.mp3`;
    const headers = { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" };

    const cached = await supabase.storage.from("voices").download(path);
    if (cached.data) return new Response(await cached.data.arrayBuffer(), { headers });

    const { audio, chars } = await voicePreview(providerVoiceId);
    await supabase.storage.from("voices").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (chars > 0) await logUsage(supabase, user.id, "tts_chars", chars, { voice_preview: id });
    return new Response(new Uint8Array(audio), { headers });
  } catch (e) {
    return handleApiError(e);
  }
}
