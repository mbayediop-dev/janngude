/** Identifiant d’une vidéo YouTube à partir des formes d’URL courantes (watch, youtu.be, shorts, embed, live) ou d’un identifiant nu. */
export function youtubeId(input: string): string | null {
  const value = input.trim();
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return validId(url.pathname.slice(1).split("/")[0]);
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") return validId(url.searchParams.get("v"));
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return validId(value);
  }
}

function validId(id: string | null | undefined) {
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export type TranscriptSegment = { text: string; offset: number; duration?: number };

/** Sous-titres → texte en paragraphes d’environ une minute, chacun précédé de son minutage. */
export function transcriptToText(segments: TranscriptSegment[], paragraphSeconds = 60): string {
  const paragraphs: string[] = [];
  const scale = offsetScale(segments);
  let current: string[] = [];
  let start = 0;
  for (const s of segments) {
    const text = decodeCaption(s.text);
    if (!text) continue;
    const offsetSec = s.offset / scale;
    if (!current.length) start = offsetSec;
    current.push(text);
    if (offsetSec - start >= paragraphSeconds) {
      paragraphs.push(`[${stamp(start)}] ${current.join(" ")}`);
      current = [];
    }
  }
  if (current.length) paragraphs.push(`[${stamp(start)}] ${current.join(" ")}`);
  return paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).join("\n\n");
}

/**
 * Selon la version de `youtube-transcript`, offsets et durées sont en secondes ou en millisecondes.
 * L’écart médian entre deux sous-titres vaut quelques secondes : au-delà de 100, l’unité est la milliseconde.
 */
function offsetScale(segments: TranscriptSegment[]) {
  const gaps = segments
    .slice(1)
    .map((s, i) => s.offset - segments[i].offset)
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  if (!gaps.length) return 1;
  return gaps[Math.floor(gaps.length / 2)] > 100 ? 1000 : 1;
}

function stamp(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function decodeCaption(s: string) {
  return s
    .replace(/&amp;#39;|&#39;/g, "’")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\[(?:Musique|Music|Applaudissements|Applause|Rires|Laughter)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
