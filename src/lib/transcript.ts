/**
 * Transcription synchronisée d’une lecture audio (mots horodatés, paragraphes, sections, forme d’onde).
 * Module pur : utilisable côté serveur comme côté client.
 */

/** [texte, début (s), fin (s)] */
export type TranscriptWord = [string, number, number];

export type TranscriptParagraph = { section: number; heading?: boolean; speaker?: string; start: number; end: number; words: TranscriptWord[] };
export type TranscriptSection = { title: string; start: number; end: number };

export type Transcript = {
  version: 1;
  duration: number;
  peaks: number[];
  sections: TranscriptSection[];
  paragraphs: TranscriptParagraph[];
};

/** Bloc de texte à synthétiser (un paragraphe ou un titre), rattaché à une section. */
export type SpeechBlock = { text: string; section: number; heading?: boolean; speaker?: string; voiceId?: string };

export type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };

const TAG_RE = /^\[[^\]]*\]$/;

/**
 * Découpe un texte en mots horodatés à partir d’un alignement caractère par caractère.
 * Les balises entre crochets ([short pause], [exhales]…) sont retirées de l’affichage.
 * Si l’alignement ne correspond pas au texte, les temps sont répartis proportionnellement.
 */
export function wordsFromAlignment(text: string, alignment: Alignment | null, from: number, to: number, offset: number, fallback: { chunkStart: number; chunkDuration: number; chunkLength: number }): TranscriptWord[] {
  const aligned = alignment && alignment.characters.length === text.length ? alignment : null;
  const timeAt = (index: number, end: boolean) => {
    if (aligned) return offset + (end ? aligned.character_end_times_seconds[index] : aligned.character_start_times_seconds[index]);
    return fallback.chunkStart + ((index + (end ? 1 : 0)) / Math.max(1, fallback.chunkLength)) * fallback.chunkDuration;
  };

  const slice = text.slice(from, to);
  const re = /\S+/g;
  const tokens: { t: string; i: number; j: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice))) tokens.push({ t: m[0], i: from + m.index, j: from + m.index + m[0].length - 1 });

  const words: TranscriptWord[] = [];
  let skippingTag = false;
  for (const tok of tokens) {
    if (skippingTag) {
      if (tok.t.endsWith("]")) skippingTag = false;
      continue;
    }
    if (TAG_RE.test(tok.t)) continue;
    if (tok.t.startsWith("[") && !tok.t.includes("]")) {
      skippingTag = true;
      continue;
    }
    const s = round(timeAt(tok.i, false));
    const e = round(Math.max(s, timeAt(tok.j, true)));
    words.push([tok.t, s, e]);
  }
  return words;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Assemble paragraphes et sections à partir des mots de chaque bloc. */
export function assembleTranscript(blocks: SpeechBlock[], wordsByBlock: TranscriptWord[][], sectionTitles: string[], duration: number, peaks: number[]): Transcript {
  const paragraphs: TranscriptParagraph[] = [];
  blocks.forEach((block, i) => {
    const words = wordsByBlock[i] ?? [];
    if (!words.length) return;
    paragraphs.push({ section: block.section, heading: block.heading || undefined, speaker: block.speaker || undefined, start: words[0][1], end: words[words.length - 1][2], words });
  });
  const sections: TranscriptSection[] = sectionTitles.map((title, index) => {
    const own = paragraphs.filter((p) => p.section === index);
    return { title, start: own.length ? own[0].start : 0, end: own.length ? own[own.length - 1].end : 0 };
  });
  return { version: 1, duration: round(duration), peaks, sections: sections.filter((s) => s.end > 0 || s.start > 0), paragraphs };
}

/** Forme d’onde simplifiée : énergie RMS par tranche, normalisée entre 0 et 1. */
export function computePeaks(samples: Int16Array, buckets = 160): number[] {
  if (!samples.length) return [];
  const size = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const start = b * size;
    const end = Math.min(samples.length, start + size);
    let sum = 0;
    for (let i = start; i < end; i++) {
      const v = samples[i] / 32768;
      sum += v * v;
    }
    peaks.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const max = Math.max(...peaks, 1e-6);
  return peaks.map((p) => Math.round((p / max) * 100) / 100);
}

// ---------------------------------------------------------------------------
// Construction des blocs à partir d’un texte (mode « lecture fidèle »)
// ---------------------------------------------------------------------------

const HEADING_HINT = /^(chapitre|partie|section|titre|introduction|conclusion|résumé|définition|objectifs?|exercices?|annexe|bibliographie)\b/i;

function cleanInline(text: string) {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\|/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function firstWords(text: string, n = 7) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = words.slice(0, n).join(" ");
  return words.length > n ? out + "…" : out;
}

/**
 * Transforme un texte (Markdown ou brut) en blocs de parole et titres de sections.
 * Titres Markdown et lignes à allure de titre ouvrent une section ; sans titre, des
 * sections sont créées automatiquement toutes les ~1 500 caractères.
 */
export function blocksFromText(text: string, pause: { short: string; long: string }): { blocks: SpeechBlock[]; sections: string[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sections: string[] = [];
  const blocks: SpeechBlock[] = [];
  let paragraph: string[] = [];
  let prevBlank = true;

  const flush = () => {
    if (!paragraph.length) return;
    const content = cleanInline(paragraph.join(" ").replace(/\s+/g, " "));
    paragraph = [];
    if (!content) return;
    if (!sections.length) sections.push(firstWords(content));
    blocks.push({ text: /[.!?…:]$/.test(content) ? content : content + ".", section: sections.length - 1 });
  };

  const NUMBERED = /^(\d{1,2}|[IVXLC]{1,6})\s*[.)\-–:]\s+\S/;
  const nextNonEmpty = (from: number) => {
    for (let k = from + 1; k < lines.length; k++) if (lines[k].trim()) return lines[k].trim();
    return "";
  };
  let firstLine = true;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || /^[-*_]{3,}$/.test(line)) {
      flush();
      prevBlank = true;
      continue;
    }
    const md = /^#{1,6}\s+(.+)$/.exec(line);
    const short = line.length <= 70 && !/[.!?;,]$/.test(line);
    const numbered = NUMBERED.test(line);
    // Un titre numéroté se distingue d’une liste numérotée : la ligne suivante n’est pas elle-même numérotée.
    const numberedHeading = numbered && short && prevBlank && !NUMBERED.test(nextNonEmpty(index));
    const keywordHeading = !numbered && prevBlank && short && !/^[-*+]\s/.test(line) && HEADING_HINT.test(line);
    const documentTitle = firstLine && short && line.length <= 80 && !/^[-*+]\s/.test(line) && nextNonEmpty(index) !== "" && !/[.!?:]$/.test(line);
    firstLine = false;
    if (md || numberedHeading || keywordHeading || documentTitle) {
      flush();
      const spoken = cleanInline(md ? md[1] : line).replace(/[:.]$/, "");
      // Le sommaire porte déjà une numérotation : on retire celle du texte.
      const title = spoken.replace(/^(\d{1,2}|[IVXLC]{1,6})\s*[.)\-–:]\s+/, "");
      sections.push(title);
      blocks.push({ text: `${pause.long} ${spoken}. ${pause.short}`, section: sections.length - 1, heading: true });
      prevBlank = false;
      continue;
    }
    if (/^\|?[\s:-]+\|[\s|:-]*$/.test(line)) continue;
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      // Chaque élément de liste devient une phrase du paragraphe courant.
      const sentence = cleanInline(item[1]);
      paragraph.push(/[.!?…]$/.test(sentence) ? sentence : sentence + ".");
    } else {
      paragraph.push(line);
    }
    prevBlank = false;
  }
  flush();

  // Sans titres : sections automatiques pour le sommaire.
  if (sections.length <= 1 && blocks.length > 2) {
    const autoSections: string[] = [];
    let current = -1;
    let size = 0;
    for (const block of blocks) {
      if (current < 0 || size > 1500) {
        current = autoSections.push(firstWords(block.text)) - 1;
        size = 0;
      }
      block.section = current;
      size += block.text.length;
    }
    return { blocks, sections: autoSections };
  }
  return { blocks, sections: sections.length ? sections : ["Lecture"] };
}

/** Balises d’expression autorisées dans un script ; toute autre balise (dont [sighs]) est retirée. */
const ALLOWED_TAGS = new Set(["short pause", "long pause", "exhales", "curious", "excited"]);

export function sanitizeSpeechTags(text: string) {
  return text
    .replace(/\[([^\]]{1,40})\]/g, (match, inner: string) => (ALLOWED_TAGS.has(inner.trim().toLowerCase()) ? match : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?…])/g, "$1")
    .trim();
}

/** Blocs à partir d’une narration structurée (mode « narration naturelle »). */
export function blocksFromNarration(sections: { title: string; paragraphs: string[] }[], longPause: string): { blocks: SpeechBlock[]; sections: string[] } {
  const titles: string[] = [];
  const blocks: SpeechBlock[] = [];
  sections.forEach((section) => {
    const paragraphs = section.paragraphs.map((p) => sanitizeSpeechTags(p)).filter(Boolean);
    if (!paragraphs.length) return;
    const index = titles.push(section.title.trim() || firstWords(paragraphs[0])) - 1;
    paragraphs.forEach((p, i) => blocks.push({ text: i === 0 && index > 0 ? `${longPause} ${p}` : p, section: index, heading: i === 0 }));
  });
  return { blocks, sections: titles };
}

/** Texte affichable d’un paragraphe (sans balises). */
export function paragraphText(p: TranscriptParagraph) {
  return p.words.map((w) => w[0]).join(" ");
}

/** Index du mot en cours de lecture (recherche dichotomique sur les débuts). */
export function findWordIndex(flat: { s: number }[], time: number) {
  let lo = 0;
  let hi = flat.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (flat[mid].s <= time) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}
