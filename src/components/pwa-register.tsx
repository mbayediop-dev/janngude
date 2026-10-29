"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/install";

/** Enregistre le service worker (écoute hors ligne, application installable) et vérifie ses mises à jour. */
export function PwaRegister() {
  useEffect(() => {
    captureInstallPrompt();
    if (!("serviceWorker" in navigator)) return;
    // Ancien cache de bundles JavaScript : on le supprime s’il subsiste (il servait des versions périmées).
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("janngude-static")).map((k) => caches.delete(k))))
        .catch(() => {});
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {
        /* hors ligne ou navigateur non compatible : l’application fonctionne sans */
      });
  }, []);
  return null;
}
