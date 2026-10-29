import { handleApiError, jsonError, ndjsonResponse, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { synthesizeBlocks, pauseMark, podcastGuestVoiceId, ttsConfigured, ttsMaxChars, TtsError, type ReadingPace, type SpeechLanguage } from "@/lib/tts";
import { blocksFromNarration, blocksFromText, sanitizeSpeechTags, type SpeechBlock } from "@/lib/transcript";
import { narrateForSpeech } from "@/lib/ai/narrate";
import { writePodcast } from "@/lib/ai/podcast";
import { describeAiError } from "@/lib/ai/client";
import { outlineToMarkdown, keyPointsToMarkdown } from "@/lib/compile";
import { logUsage } from "@/lib/usage";
import type { AudioSource, VoiceKind } from "@/lib/supabase/types";

export const maxDuration = 300;

type Stage = "narration" | "synthesis" | "encoding" | "upload";
const LANGUAGE_LABEL: Record<SpeechLanguage, string> = { fr: "", en: " · english", wo: " · wolof" };

export async function POST(req: Request, ctx: RouteContext<"/api/courses/[id]/audio">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    if (!ttsConfigured()) throw new ApiError("La lecture audio n’est pas configurée (NEXT_ILEVENLABS_KEY).", 503);

    const body = await readJsonBody<{ source?: AudioSource; summaryId?: string; voice?: VoiceKind; voiceId?: string; mode?: "natural" | "faithful"; pace?: ReadingPace; language?: SpeechLanguage }>(req);
    const source: AudioSource = (["summary", "outline", "keypoints", "podcast"] as const).includes(body.source as "summary") ? (body.source as AudioSource) : "course";
    const voiceKind: VoiceKind = body.voice === "custom" || body.voiceId ? "custom" : "default";
    const mode = source === "podcast" ? "natural" : body.mode === "faithful" ? "faithful" : "natural";
    const pace: ReadingPace = body.pace === "slow" || body.pace === "fast" ? body.pace : "normal";
    const language: SpeechLanguage = body.language === "en" || body.language === "wo" ? body.language : "fr";

    const { data: course } = await supabase.from("courses").select("id,title,domain,subject,content_text,outline,key_points").eq("id", id).maybeSingle();
    if (!course || !course.content_text) return jsonError("Cours introuvable ou non analysé.", 404);

    let text = course.content_text;
    let title = `${course.title} — lecture du cours`;
    let summaryId: string | null = null;
    if (source === "outline") {
      text = outlineToMarkdown(course.outline);
      title = `${course.title} — grandes lignes`;
      if (!text) throw new ApiError("Aucune grande ligne disponible pour ce cours.");
    } else if (source === "keypoints") {
      text = keyPointsToMarkdown(course.key_points);
      title = `${course.title} — points à retenir`;
      if (!text) throw new ApiError("Aucun point à retenir disponible pour ce cours.");
    } else if (source === "podcast") {
      title = `${course.title} — podcast`;
    } else if (source === "summary") {
      if (!body.summaryId) throw new ApiError("Résumé manquant.");
      const { data: summary } = await supabase.from("summaries").select("id,title,content").eq("id", body.summaryId).eq("course_id", id).maybeSingle();
      if (!summary) return jsonError("Résumé introuvable.", 404);
      text = summary.content;
      title = `${course.title} — ${summary.title.toLowerCase()}`;
      summaryId = summary.id;
    }

    const limit = ttsMaxChars();
    // Le podcast est un dialogue écrit par Claude, borné par `podcastBudget` : la longueur du cours ne le bloque pas.
    if (source !== "podcast" && text.length > limit) throw new ApiError(`Texte trop long pour une lecture (${text.length.toLocaleString("fr-FR")} caractères, limite ${limit.toLocaleString("fr-FR")}). Lisez un résumé.`);
    if (text.trim().length < 20) throw new ApiError("Rien à lire.");

    let voiceId: string | undefined;
    let voiceName = "Voix par défaut";
    if (voiceKind === "custom") {
      if (!body.voiceId) throw new ApiError("Choisissez une voix.");
      const { data: voiceRow } = await supabase.from("voices").select("id,name,provider_voice_id").eq("id", body.voiceId).eq("user_id", user.id).maybeSingle();
      if (!voiceRow) throw new ApiError("Voix introuvable. Ajoutez-la dans Paramètres.");
      voiceId = voiceRow.provider_voice_id;
      voiceName = voiceRow.name;
    }
    const voiceLabel = source === "podcast" ? `Podcast · ${voiceName} & invité${LANGUAGE_LABEL[language]}` : `${voiceName}${mode === "natural" ? " · narration" : ""}${LANGUAGE_LABEL[language]}`;

    return ndjsonResponse(async (emit) => {
      const progress = (percent: number, stage: Stage, detail?: string) => emit({ type: "progress", percent: Math.max(0, Math.min(100, Math.round(percent))), stage, detail });
      try {
        const pause = { short: pauseMark("short"), long: pauseMark("long") };
        let blocks: SpeechBlock[];
        let sections: string[];
        const synthStart = mode === "natural" ? 36 : 3;

        // 1) Script de lecture
        if (source === "podcast") {
          progress(2, "narration", "dialogue");
          let podcast;
          try {
            podcast = await writePodcast({ text, title: course.title, domain: course.domain, subject: course.subject, language, maxChars: limit }, (f) => progress(2 + f * 33, "narration", "dialogue"));
          } catch (error) {
            throw new Error("Impossible d’écrire le podcast : " + describeAiError(error));
          }
          const guestVoice = podcastGuestVoiceId();
          sections = [];
          blocks = [];
          podcast.sections.forEach((section) => {
            const lines = section.lines.map((l) => ({ ...l, text: sanitizeSpeechTags(l.text) })).filter((l) => l.text);
            if (!lines.length) return;
            const index = sections.push(section.title.trim() || `Partie ${sections.length + 1}`) - 1;
            lines.forEach((l, i) =>
              blocks.push({
                text: i === 0 && index > 0 ? `${pause.long} ${l.text}` : l.text,
                section: index,
                heading: i === 0,
                speaker: l.speaker === "host" ? "Enseignant" : "Étudiant",
                voiceId: l.speaker === "host" ? voiceId : guestVoice,
              }),
            );
          });
          await logUsage(supabase, user.id, "ai_narration_chars", text.length, { course_id: id, source, language });
        } else if (mode === "natural") {
          progress(2, "narration");
          let narration;
          try {
            narration = await narrateForSpeech({ text, title: course.title, domain: course.domain, subject: course.subject, language }, (f) => progress(2 + f * 33, "narration"));
          } catch (error) {
            throw new Error("Impossible de préparer la narration : " + describeAiError(error));
          }
          ({ blocks, sections } = blocksFromNarration(narration.sections, pause.long));
          if (!blocks.length) ({ blocks, sections } = blocksFromText(text, pause));
          await logUsage(supabase, user.id, "ai_narration_chars", text.length, { course_id: id, source, language });
        } else {
          ({ blocks, sections } = blocksFromText(text, pause));
        }
        if (!blocks.length) throw new Error("Rien à lire.");

        // 2) Synthèse vocale avec horodatages, normalisation et encodage
        progress(synthStart, "synthesis");
        const { audio, chars, durationSeconds, transcript } = await synthesizeBlocks(blocks, sections, {
          voiceId,
          pace,
          language,
          onProgress: (p) => {
            if (p.stage === "synthesis") progress(synthStart + (p.done / Math.max(1, p.total)) * 52, "synthesis", `${Math.min(p.done + 1, p.total)}/${p.total}`);
            else progress(synthStart + 53, "encoding");
          },
        });
        await logUsage(supabase, user.id, "tts_chars", chars, { course_id: id, source, language, seconds: durationSeconds });

        // 3) Enregistrement
        progress(94, "upload");
        const base = `${user.id}/${course.id}/${crypto.randomUUID()}`;
        const path = `${base}.mp3`;
        const { error: uploadError } = await supabase.storage.from("audio").upload(path, audio, { contentType: "audio/mpeg", upsert: false });
        if (uploadError) throw new Error("Échec de l’enregistrement du fichier audio : " + uploadError.message);
        const { error: transcriptError } = await supabase.storage.from("audio").upload(`${base}.json`, Buffer.from(JSON.stringify(transcript)), { contentType: "application/json", upsert: false });
        if (transcriptError) console.error("Transcription non enregistrée :", transcriptError.message);

        const { data: row, error } = await supabase
          .from("audio_readings")
          .insert({ course_id: course.id, user_id: user.id, summary_id: summaryId, source, voice_kind: voiceKind, voice_label: voiceLabel, title, file_path: path, duration_seconds: durationSeconds, char_count: chars })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        progress(100, "upload");
        emit({ type: "done", audio: row });
      } catch (error) {
        emit({ type: "error", message: error instanceof TtsError || error instanceof Error ? error.message : "Erreur inattendue." });
      }
    });
  } catch (e) {
    return handleApiError(e);
  }
}
