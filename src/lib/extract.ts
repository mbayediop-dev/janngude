import "server-only";
import { transcribeDocument } from "@/lib/ai/transcribe";
import { transcribeAudio } from "@/lib/tts";
import { extractPptx } from "@/lib/pptx";

export const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/plain": "Texte",
  "text/markdown": "Markdown",
  "image/jpeg": "Image",
  "image/png": "Image",
  "image/webp": "Image",
  "audio/mpeg": "Audio",
  "audio/mp4": "Audio",
  "audio/x-m4a": "Audio",
  "audio/wav": "Audio",
  "audio/x-wav": "Audio",
  "audio/webm": "Audio",
  "audio/ogg": "Audio",
  "video/mp4": "Vidéo",
};

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md", ".jpg", ".jpeg", ".png", ".webp", ".mp3", ".m4a", ".wav", ".webm", ".ogg", ".mp4"];

export function mimeFromName(name: string, fallback = "application/octet-stream") {
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
  };
  return map[ext] ?? fallback;
}

export function isAudioMime(mime: string) {
  return mime.startsWith("audio/") || mime === "video/mp4";
}

export type Extraction = { text: string; method: "text" | "transcription"; pages?: number };

/** Extrait le texte d’un fichier de cours. Les PDF scannés et les images passent par une transcription IA, l’audio par la reconnaissance vocale. */
export async function extractText(buffer: Buffer, mime: string, fileName: string): Promise<Extraction> {
  const type = mime && mime !== "application/octet-stream" ? mime : mimeFromName(fileName);

  if (type === "application/pdf") {
    const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await pdfText(pdf, { mergePages: true });
    const cleaned = normalize(text);
    const avgPerPage = cleaned.length / Math.max(1, totalPages);
    if (avgPerPage >= 120) {
      return { text: cleaned, method: "text", pages: totalPages };
    }
    // Peu ou pas de couche texte : PDF scanné → transcription.
    const transcribed = await transcribeDocument(buffer, "application/pdf");
    return { text: normalize(transcribed), method: "transcription", pages: totalPages };
  }

  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: normalize(result.value), method: "text" };
  }

  if (type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return { text: normalize(await extractPptx(buffer)), method: "text" };
  }

  if (type.startsWith("text/")) {
    return { text: normalize(buffer.toString("utf8")), method: "text" };
  }

  if (type.startsWith("image/")) {
    const transcribed = await transcribeDocument(buffer, type);
    return { text: normalize(transcribed), method: "transcription" };
  }

  if (isAudioMime(type)) {
    const transcribed = await transcribeAudio(buffer, type, fileName);
    return { text: normalize(transcribed), method: "transcription" };
  }

  throw new Error("Format de fichier non pris en charge. Utilisez un PDF, un document Word ou PowerPoint, un fichier texte, une image ou un enregistrement audio.");
}

function normalize(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
