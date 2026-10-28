"use client";

import { toast } from "sonner";

/** Lit un flux NDJSON et appelle onEvent pour chaque ligne. */
export async function readNdjson(response: Response, onEvent: (event: Record<string, unknown>) => void) {
  if (!response.ok || !response.body) {
    let message = `Erreur ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer.trim()));
}

export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data;
}

export async function copyToClipboard(text: string, message = "Copié dans le presse-papiers") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Impossible de copier automatiquement.");
  }
}

export function audioPublicUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/audio/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function downloadUrl(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** URL publique de la transcription synchronisée d’une lecture (JSON à côté du MP3). */
export function transcriptPublicUrl(filePath: string) {
  return audioPublicUrl(filePath.replace(/\.mp3$/, ".json"));
}
