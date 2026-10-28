import { handleApiError, requireApiUser, ApiError } from "@/lib/api";
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

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    if (!ttsConfigured()) throw new ApiError("La voix personnalisée n’est pas configurée (NEXT_ILEVENLABS_KEY).", 503);

    const { count } = await supabase.from("voices").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    const max = maxVoicesPerUser();
    if ((count ?? 0) >= max) throw new ApiError(`Vous avez atteint le maximum de ${max} voix. Supprimez-en une pour en ajouter une nouvelle.`);

    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") ?? "Ma voix").trim().slice(0, 40) || "Ma voix";
    if (!(file instanceof File)) throw new ApiError("Fichier audio manquant.");
    if (file.size > 20 * 1024 * 1024) throw new ApiError("Fichier trop volumineux (20 Mo maximum).");
    if (file.size < 20 * 1024) throw new ApiError("Enregistrement trop court : lisez le texte pendant au moins 30 secondes.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "audio/webm";
    const fileName = file.name || "sample.webm";

    let providerVoiceId: string;
    try {
      providerVoiceId = await cloneVoice(`Janngude — ${name} (${user.id.slice(0, 8)})`, { buffer, fileName, mime });
    } catch (error) {
      if (error instanceof TtsError) throw new ApiError(error.message, 502);
      throw error;
    }

    // Conserve l’échantillon dans l’espace privé de l’utilisateur.
    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".webm";
    const samplePath = `${user.id}/${providerVoiceId}${ext}`;
    await supabase.storage.from("voices").upload(samplePath, buffer, { contentType: mime, upsert: true });

    const { data: row, error } = await supabase.from("voices").insert({ user_id: user.id, name, provider_voice_id: providerVoiceId, sample_path: samplePath }).select("id,name,created_at").single();
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true, voice: row });
  } catch (e) {
    return handleApiError(e);
  }
}
