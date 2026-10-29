"use client";

/**
 * Installation de l’application (PWA) : capture de l’invite du navigateur (Chrome, Edge, Android),
 * détection du mode « installée » et de la plateforme pour afficher les bonnes instructions (iOS, ordinateur).
 */

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BeforeInstallPromptEvent | null = null;
let captured = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** À appeler une fois au chargement (PwaRegister) : retient l’invite d’installation pour la déclencher sur un bouton. */
export function captureInstallPrompt() {
  if (captured || typeof window === "undefined") return;
  captured = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", emit);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallPlatform = "ios" | "android" | "desktop";

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** Instantané stable (chaîne) pour useSyncExternalStore : « invite disponible | installée | plateforme ». */
export function installSnapshot(): string {
  return `${deferred ? 1 : 0}|${isStandalone() ? 1 : 0}|${detectPlatform()}`;
}

export const INSTALL_SERVER_SNAPSHOT = "0|0|desktop";

export function parseInstallSnapshot(snapshot: string): { canPrompt: boolean; installed: boolean; platform: InstallPlatform } {
  const [prompt, installed, platform] = snapshot.split("|");
  return { canPrompt: prompt === "1", installed: installed === "1", platform: (platform as InstallPlatform) || "desktop" };
}

export function subscribeInstall(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Ouvre l’invite native si le navigateur l’a proposée. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  await event.prompt();
  const { outcome } = await event.userChoice;
  deferred = null;
  emit();
  return outcome;
}
