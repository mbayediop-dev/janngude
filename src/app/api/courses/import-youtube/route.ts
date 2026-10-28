import { handleApiError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { logUsage } from "@/lib/usage";
import { youtubeId, transcriptToText } from "@/lib/youtube";

export const maxDuration = 60;

/** Crée un cours à partir des sous-titres d’une vidéo YouTube (l’analyse se lance ensuite comme pour un fichier). */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ url?: string; domain?: string; subject?: string; title?: string }>(req);
    const id = youtubeId(body.url ?? "");
    if (!id) throw new ApiError("Lien YouTube non reconnu.");
    const domain = (body.domain ?? "").trim().slice(0, 80);
    const subject = (body.subject ?? "").trim().slice(0, 80);
    if (!domain || !subject) throw new ApiError("Indiquez la formation et la matière.");

    // Titre et chaîne via oEmbed (sans clé API) ; facultatif.
    let videoTitle = "";
    let author = "";
    try {
      const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
      if (o.ok) {
        const data = (await o.json()) as { title?: string; author_name?: string };
        videoTitle = data.title ?? "";
        author = data.author_name ?? "";
      }
    } catch {
      /* titre facultatif */
    }

    // Sous-titres : français de préférence, sinon la première langue disponible.
    const { YoutubeTranscript } = await import("youtube-transcript");
    let segments: { text: string; offset: number }[] = [];
    try {
      segments = await YoutubeTranscript.fetchTranscript(id, { lang: "fr" }).catch(() => YoutubeTranscript.fetchTranscript(id));
    } catch {
      throw new ApiError("Cette vidéo n’a pas de sous-titres disponibles (ni générés automatiquement). Déposez son audio en note audio pour la transcrire.", 422);
    }
    const text = transcriptToText(segments);
    if (text.length < 200) throw new ApiError("Les sous-titres de cette vidéo sont trop courts pour en faire un cours.", 422);

    const title = (body.title ?? "").trim().slice(0, 140) || videoTitle.slice(0, 140) || `Vidéo YouTube ${id}`;
    const { data: course, error } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        title,
        domain,
        subject,
        file_name: `https://www.youtube.com/watch?v=${id}`,
        file_type: "video/youtube",
        status: "uploaded",
        content_text: `${videoTitle ? `# ${videoTitle}\n\n` : ""}${author ? `Chaîne : ${author}\n\n` : ""}${text}`,
      })
      .select("id")
      .single();
    if (error) throw new ApiError(error.message, 500);
    await logUsage(supabase, user.id, "import_youtube", 1, { course_id: course.id, video: id });
    return Response.json({ id: course.id, title });
  } catch (e) {
    return handleApiError(e);
  }
}
