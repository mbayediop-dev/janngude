import "server-only";
import { pcm16FromBuffer, concatPcm, normalizeLoudness, encodeMp3 } from "./audio";
import { assembleTranscript, computePeaks, wordsFromAlignment, type Alignment, type SpeechBlock, type Transcript, type TranscriptWord } from "./transcript";

const API = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || "cEjGxRhK5rId1bacJPJr"; // « Bakumba », voix française de la bibliothèque ElevenLabs du compte
/** Modèle de synthèse : v4 lit avec expressivité (balises [exhales], [short pause]…) et pauses par ponctuation. */
export const TTS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_v4";
const EXPRESSIVE = /^eleven_v[34]/.test(TTS_MODEL);
const CHUNK_SIZE = EXPRESSIVE ? 3000 : 2400;
const CONTEXT_CHARS = 600;
const SAMPLE_RATE = 24000;
const MP3_KBPS = 96;

export type ReadingPace = "slow" | "normal" | "fast";
const PACE_SPEED: Record<ReadingPace, number> = { slow: 0.85, normal: 0.93, fast: 1.02 };

function voiceSettings(pace: ReadingPace) {
  const speed = PACE_SPEED[pace] ?? PACE_SPEED.normal;
  return EXPRESSIVE
    ? { stability: 0.5, similarity_boost: 0.8, speed }
    : { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed };
}

function apiKey() {
  return process.env.NEXT_ILEVENLABS_KEY || process.env.ELEVENLABS_API_KEY || "";
}

export function ttsConfigured() {
  return apiKey().length > 0;
}

export function ttsMaxChars() {
  const n = Number(process.env.TTS_MAX_CHARS);
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

export function defaultVoiceId() {
  return DEFAULT_VOICE_ID;
}

export class TtsError extends Error {}

async function elevenFetch(path: string, init: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": apiKey(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = "";
    let status = "";
    try {
      const body = (await res.json()) as { detail?: { message?: string; status?: string; code?: string } | string };
      if (typeof body.detail === "string") detail = body.detail;
      else {
        detail = body.detail?.message ?? "";
        status = body.detail?.status ?? body.detail?.code ?? "";
      }
    } catch {
      /* ignore */
    }
    // ElevenLabs répond 401 « quota_exceeded » quand les crédits du mois sont épuisés : ce n’est pas une clé invalide.
    if (status === "quota_exceeded" || res.status === 402 || /quota/i.test(detail)) {
      const sub = await elevenSubscription().catch(() => null);
      const amount = sub ? ` (${sub.used.toLocaleString("fr-FR")} / ${sub.limit.toLocaleString("fr-FR")} caractères)` : "";
      const reset = sub?.resetAt ? ` Il se renouvelle le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(sub.resetAt)}.` : "";
      throw new TtsError(`Quota de caractères ElevenLabs épuisé pour ce mois${amount}.${reset} Le compte est partagé par tous les étudiants : contactez l’administrateur.`);
    }
    if (res.status === 401) throw new TtsError(`Clé ElevenLabs refusée (NEXT_ILEVENLABS_KEY)${detail ? ` : ${detail}` : ""}.`);
    throw new TtsError(detail ? `ElevenLabs : ${detail}` : `ElevenLabs a répondu ${res.status}.`);
  }
  return res;
}

export type ElevenSubscription = { tier: string; used: number; limit: number; resetAt: Date | null; voicesUsed: number; voiceLimit: number };

/** État de l’abonnement ElevenLabs (quota de caractères du mois, voix) pour l’administration et les messages d’erreur. */
export async function elevenSubscription(): Promise<ElevenSubscription> {
  const res = await fetch(`${API}/user/subscription`, { headers: { "xi-api-key": apiKey() }, cache: "no-store" });
  if (!res.ok) throw new TtsError(`ElevenLabs a répondu ${res.status}.`);
  const d = (await res.json()) as { tier?: string; character_count?: number; character_limit?: number; next_character_count_reset_unix?: number; voice_slots_used?: number; voice_limit?: number };
  return {
    tier: d.tier ?? "",
    used: d.character_count ?? 0,
    limit: d.character_limit ?? 0,
    resetAt: d.next_character_count_reset_unix ? new Date(d.next_character_count_reset_unix * 1000) : null,
    voicesUsed: d.voice_slots_used ?? 0,
    voiceLimit: d.voice_limit ?? 0,
  };
}

/** Découpe un texte en morceaux ≤ CHUNK_SIZE caractères, en respectant paragraphes et phrases. */
export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= size) {
      current = current ? current + "\n\n" + paragraph : paragraph;
      continue;
    }
    push();
    if (paragraph.length <= size) {
      current = paragraph;
      continue;
    }
    // Paragraphe trop long : découpe par phrases.
    const sentences = paragraph.match(/[^.!?…]+[.!?…]+[\s"»)]*|[^.!?…]+$/g) ?? [paragraph];
    for (const sentence of sentences) {
      if ((current + " " + sentence).length <= size) {
        current = current ? current + " " + sentence : sentence;
      } else {
        push();
        if (sentence.length > size) {
          for (let i = 0; i < sentence.length; i += size) chunks.push(sentence.slice(i, i + size));
        } else {
          current = sentence;
        }
      }
    }
  }
  push();
  return chunks;
}

/** Marque de pause adaptée au modèle (balise v3/v4, sinon SSML). */
export function pauseMark(kind: "short" | "long") {
  if (EXPRESSIVE) return kind === "short" ? "[short pause]" : "[long pause]";
  return kind === "short" ? '<break time="0.7s" />' : '<break time="1.2s" />';
}

/** Convertit du Markdown en texte lisible à voix haute, avec des pauses aux titres et entre paragraphes. */
export function markdownToSpeech(markdown: string): string {
  const shortPause = pauseMark("short");
  const longPause = pauseMark("long");
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, `${longPause} $1. ${shortPause}`)
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*\|?[\s:-]+\|[\s|:-]*$/gm, "")
    .replace(/\|/g, ", ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^.!?…\s])\n\n/g, "$1.\n\n")
    .trim();
}

/**
 * Synthétise un texte en MP3. Les morceaux sont demandés en PCM, assemblés, puis le niveau
 * sonore est normalisé (les voix ElevenLabs sortent souvent trop bas) avant l’encodage MP3.
 */
export type SynthesisProgress = { stage: "synthesis"; done: number; total: number } | { stage: "encoding" };

type Chunk = { text: string; voiceId?: string; spans: { block: number; from: number; to: number }[] };

/** Voix du second intervenant des podcasts (par défaut « Audrey », voix française de la bibliothèque). */
export function podcastGuestVoiceId() {
  return process.env.ELEVENLABS_PODCAST_VOICE_ID || "McVZB9hVxVSk3Equu8EH";
}

export type SpeechLanguage = "fr" | "en" | "wo";

/** Regroupe les blocs en morceaux ≤ CHUNK_SIZE (coupure entre blocs, ou par phrases pour un bloc trop long). */
function chunkBlocks(blocks: SpeechBlock[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = { text: "", spans: [] };
  const push = () => {
    if (current.spans.length) chunks.push(current);
    current = { text: "", spans: [] };
  };
  const append = (block: number, piece: string, voiceId?: string) => {
    const sep = current.text ? "\n\n" : "";
    // Nouveau morceau si la taille déborde ou si la voix change (podcast à deux voix).
    if (current.text && ((current.text + sep + piece).length > CHUNK_SIZE || current.voiceId !== voiceId)) push();
    const from = current.text ? current.text.length + 2 : 0;
    current.text = current.text ? current.text + "\n\n" + piece : piece;
    current.voiceId = voiceId;
    current.spans.push({ block, from, to: from + piece.length });
  };

  blocks.forEach((block, index) => {
    const text = block.text.trim();
    if (!text) return;
    if (text.length <= CHUNK_SIZE) {
      append(index, text, block.voiceId);
      return;
    }
    const sentences = text.match(/[^.!?…]+[.!?…]+[\s"»)]*|[^.!?…]+$/g) ?? [text];
    let piece = "";
    for (const sentence of sentences) {
      if ((piece + " " + sentence).trim().length > CHUNK_SIZE && piece) {
        append(index, piece.trim(), block.voiceId);
        piece = "";
      }
      piece = piece ? piece + " " + sentence : sentence;
    }
    if (piece.trim()) append(index, piece.trim(), block.voiceId);
  });
  push();
  return chunks;
}

/**
 * Synthétise des blocs de texte en MP3 avec une transcription synchronisée (mots horodatés,
 * paragraphes, sections, forme d’onde). Les morceaux sont demandés en PCM avec horodatages,
 * assemblés, puis le niveau sonore est normalisé avant l’encodage MP3.
 */
export async function synthesizeBlocks(
  blocks: SpeechBlock[],
  sectionTitles: string[],
  options: { voiceId?: string; pace?: ReadingPace; language?: SpeechLanguage; onProgress?: (p: SynthesisProgress) => void } = {},
): Promise<{ audio: Buffer; chars: number; durationSeconds: number; gainDb: number; transcript: Transcript }> {
  if (!ttsConfigured()) throw new TtsError("La lecture audio n’est pas configurée (NEXT_ILEVENLABS_KEY).");
  const { voiceId, pace = "normal", language = "fr", onProgress } = options;
  const defaultVoice = voiceId || DEFAULT_VOICE_ID;
  const chunks = chunkBlocks(blocks);
  const settings = voiceSettings(pace);
  const parts: Int16Array[] = [];
  const wordsByBlock: TranscriptWord[][] = blocks.map(() => []);
  let offset = 0;
  let chars = 0;
  onProgress?.({ stage: "synthesis", done: 0, total: chunks.length });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    chars += chunk.text.length;
    const body: Record<string, unknown> = {
      text: chunk.text,
      model_id: TTS_MODEL,
      voice_settings: settings,
      previous_text: i > 0 ? chunks[i - 1].text.slice(-CONTEXT_CHARS) : undefined,
      next_text: i < chunks.length - 1 ? chunks[i + 1].text.slice(0, CONTEXT_CHARS) : undefined,
    };
    if (TTS_MODEL !== "eleven_multilingual_v2") body.language_code = language;
    const voice = chunk.voiceId || defaultVoice;

    const res = await elevenFetch(`/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=pcm_${SAMPLE_RATE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { audio_base64: string; alignment?: Alignment | null };
    const samples = pcm16FromBuffer(Buffer.from(data.audio_base64, "base64"));
    const chunkDuration = samples.length / SAMPLE_RATE;
    parts.push(samples);

    for (const span of chunk.spans) {
      const words = wordsFromAlignment(chunk.text, data.alignment ?? null, span.from, span.to, offset, { chunkStart: offset, chunkDuration, chunkLength: chunk.text.length });
      wordsByBlock[span.block].push(...words);
    }
    offset += chunkDuration;
    onProgress?.({ stage: "synthesis", done: i + 1, total: chunks.length });
  }

  onProgress?.({ stage: "encoding" });
  const samples = concatPcm(parts);
  const { gainDb } = normalizeLoudness(samples);
  const peaks = computePeaks(samples);
  const audio = encodeMp3(samples, SAMPLE_RATE, MP3_KBPS);
  const duration = samples.length / SAMPLE_RATE;
  const transcript = assembleTranscript(blocks, wordsByBlock, sectionTitles, duration, peaks);
  return { audio, chars, durationSeconds: Math.round(duration), gainDb, transcript };
}

/** Clone instantané d’une voix à partir d’un échantillon audio. */
export async function cloneVoice(name: string, file: { buffer: Buffer; fileName: string; mime: string }): Promise<string> {
  if (!ttsConfigured()) throw new TtsError("La voix personnalisée n’est pas configurée (NEXT_ILEVENLABS_KEY).");
  const form = new FormData();
  form.append("name", name);
  form.append("remove_background_noise", "true");
  form.append("files", new Blob([new Uint8Array(file.buffer)], { type: file.mime }), file.fileName);
  const res = await elevenFetch("/voices/add", { method: "POST", body: form });
  const data = (await res.json()) as { voice_id: string };
  return data.voice_id;
}

export async function deleteVoice(voiceId: string): Promise<void> {
  if (!ttsConfigured()) return;
  try {
    await elevenFetch(`/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
  } catch {
    // La voix a peut-être déjà été supprimée côté ElevenLabs.
  }
}

/** Reconnaissance vocale (ElevenLabs Scribe) : transcrit un enregistrement de cours en texte. */
export async function transcribeAudio(buffer: Buffer, mime: string, fileName = "audio"): Promise<string> {
  if (!ttsConfigured()) throw new TtsError("La transcription audio n’est pas configurée (NEXT_ILEVENLABS_KEY).");
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime || "audio/mpeg" }), fileName);
  const res = await elevenFetch("/speech-to-text", { method: "POST", body: form });
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (text.length < 20) throw new TtsError("La transcription est vide : l’enregistrement est-il audible ?");
  // Paragraphes à partir des fins de phrases, pour une lecture et une analyse plus agréables.
  return text.replace(/([.!?…])\s+(?=[A-ZÀ-Ý])/g, "$1\n\n");
}
