import { handleApiError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { cloneVoice, ttsConfigured, TtsError } from "@/lib/tts";
import { maxVoicesPerUser } from "@/lib/voices";

export const maxDuration = 120;

export async function GET() {
  try {
    const { supabase, user } = await requireApiUser();
    const { data, error } = await supabase.from("voices").select("id,name,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ voices: data ?? [], max: maxVoicesPerUser() });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * Crée une voix à partir d’un échantillon déjà déposé par le navigateur dans le bucket privé « voices »
 * (dossier de l’utilisateur). Le fichier ne transite pas par cette route : les fonctions Vercel limitent le corps des requêtes à 4,5 Mo.
 */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    if (!ttsConfigured()) throw new ApiError("La voix personnalisée n’est pas configurée (NEXT_ILEVENLABS_KEY).", 503);

    const { count } = await supabase.from("voices").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    const max = maxVoicesPerUser();
    if ((count ?? 0) >= max) throw new ApiError(`Vous avez atteint le maximum de ${max} voix. Supprimez-en une pour en ajouter une nouvelle.`);

    const body = await readJsonBody<{ name?: string; samplePath?: string; fileName?: string; mime?: string }>(req);
    const name = (body.name ?? "Ma voix").trim().slice(0, 40) || "Ma voix";
    const samplePath = (body.samplePath ?? "").trim();
    if (!samplePath.startsWith(`${user.id}/`) || samplePath.includes("..")) throw new ApiError("Échantillon introuvable.");

    const { data: blob, error: downloadError } = await supabase.storage.from("voices").download(samplePath);
    if (downloadError || !blob) throw new ApiError("Échantillon introuvable : l’envoi a échoué, réessayez.", 404);
    if (blob.size > 20 * 1024 * 1024) throw new ApiError("Fichier trop volumineux (20 Mo maximum).");
    if (blob.size < 20 * 1024) throw new ApiError("Enregistrement trop court : lisez le texte pendant au moins 30 secondes.");

    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = body.mime || blob.type || "audio/webm";
    const fileName = body.fileName || samplePath.slice(samplePath.lastIndexOf("/") + 1);

    let providerVoiceId: string;
    try {
      providerVoiceId = await cloneVoice(`Janngude — ${name} (${user.id.slice(0, 8)})`, { buffer, fileName, mime });
    } catch (error) {
      await supabase.storage.from("voices").remove([samplePath]).catch(() => {});
      if (error instanceof TtsError) throw new ApiError(error.message, 502);
      throw error;
    }

    const { data: row, error } = await supabase.from("voices").insert({ user_id: user.id, name, provider_voice_id: providerVoiceId, sample_path: samplePath }).select("id,name,created_at").single();
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true, voice: row });
  } catch (e) {
    return handleApiError(e);
  }
}
