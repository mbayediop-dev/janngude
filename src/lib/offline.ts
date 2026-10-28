"use client";

/**
 * Écoute hors ligne : les MP3 et transcriptions téléchargés sont conservés dans le Cache API,
 * la liste des lectures disponibles dans le localStorage. Positions de lecture mémorisées par lecture.
 */

export const MEDIA_CACHE = "janngude-media-v1";
const OFFLINE_KEY = "janngude:offline";
const POSITION_PREFIX = "janngude:pos:";
const EVENT = "janngude:offline-change";

export type OfflineTrack = {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  transcriptUrl: string | null;
  domain?: string;
  durationSeconds?: number | null;
  savedAt: string;
};

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible (navigation privée…) */
  }
}

export function offlineSupported() {
  return typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;
}

export function listOfflineTracks(): OfflineTrack[] {
  try {
    const raw = safeRead(OFFLINE_KEY);
    return raw ? (JSON.parse(raw) as OfflineTrack[]) : [];
  } catch {
    return [];
  }
}

/** Snapshot stable (chaîne) pour useSyncExternalStore. */
export function offlineSnapshot(): string {
  return safeRead(OFFLINE_KEY) ?? "[]";
}

export function subscribeOffline(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

/** Télécharge le MP3 et la transcription dans le cache, avec progression (0..1). */
export async function downloadForOffline(track: Omit<OfflineTrack, "savedAt">, onProgress?: (fraction: number) => void) {
  if (!offlineSupported()) throw new Error("L’écoute hors ligne n’est pas prise en charge par ce navigateur.");
  const cache = await caches.open(MEDIA_CACHE);

  const res = await fetch(track.src);
  if (!res.ok || !res.body) throw new Error("Téléchargement impossible.");
  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.(Math.min(0.95, received / total));
  }
  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
  await cache.put(track.src, new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size) } }));

  if (track.transcriptUrl) {
    const t = await fetch(track.transcriptUrl).catch(() => null);
    if (t?.ok) await cache.put(track.transcriptUrl, t.clone());
  }
  // Page hors ligne et manifeste, pour que l’application s’ouvre sans réseau.
  await Promise.allSettled([cache.add("/offline.html"), cache.add("/manifest.webmanifest")]);

  const list = listOfflineTracks().filter((t) => t.id !== track.id);
  list.unshift({ ...track, savedAt: new Date().toISOString() });
  safeWrite(OFFLINE_KEY, JSON.stringify(list));
  onProgress?.(1);
  notify();
}

export async function removeOffline(id: string) {
  const list = listOfflineTracks();
  const track = list.find((t) => t.id === id);
  if (track && offlineSupported()) {
    const cache = await caches.open(MEDIA_CACHE);
    await cache.delete(track.src);
    if (track.transcriptUrl) await cache.delete(track.transcriptUrl);
  }
  safeWrite(OFFLINE_KEY, JSON.stringify(list.filter((t) => t.id !== id)));
  notify();
}

export function isOffline(id: string) {
  return listOfflineTracks().some((t) => t.id === id);
}

// ---- Position de lecture ---------------------------------------------------

export function readPosition(id: string): number {
  const v = Number(safeRead(POSITION_PREFIX + id));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function savePosition(id: string, seconds: number, duration?: number) {
  // Fin de lecture atteinte : on oublie la position.
  if (duration && seconds > duration - 5) {
    safeWrite(POSITION_PREFIX + id, null);
    return;
  }
  if (seconds > 3) safeWrite(POSITION_PREFIX + id, String(Math.floor(seconds)));
}

/** Snapshot stable des positions pour une liste d’identifiants. */
export function positionsSnapshot(ids: string[]): string {
  return ids.map((id) => `${id}:${readPosition(id)}`).join("|");
}

export function subscribePositions(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("janngude:position", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("janngude:position", callback);
  };
}

export function notifyPosition() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("janngude:position"));
}

// ---- Mode Parcœuriser (apprentissage par cœur) ------------------------------------------------------
// Chaque partie se répète jusqu’à ce que l’étudiant la valide ; les parties maîtrisées sont mémorisées par lecture.

const LEARN_KEY = "janngude:learn-mode";
const MASTERY_PREFIX = "janngude:mastery:";

export function readLearnMode(): boolean {
  return safeRead(LEARN_KEY) === "1";
}

export function saveLearnMode(on: boolean) {
  safeWrite(LEARN_KEY, on ? "1" : null);
}

/** Index des parties validées pour une lecture. */
export function readMastery(id: string): number[] {
  try {
    const raw = safeRead(MASTERY_PREFIX + id);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is number => Number.isInteger(n) && n >= 0) : [];
  } catch {
    return [];
  }
}

export function saveMastery(id: string, sections: number[]) {
  safeWrite(MASTERY_PREFIX + id, sections.length ? JSON.stringify(sections) : null);
}
