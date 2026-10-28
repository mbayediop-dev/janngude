"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CloudDownload, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadForOffline, offlineSnapshot, offlineSupported, removeOffline, subscribeOffline, type OfflineTrack } from "@/lib/offline";

/** Bouton « Hors ligne » : télécharge une lecture (MP3 + sous-titres) pour l’écouter sans connexion. */
export function OfflineButton({ track, size = "sm" }: { track: Omit<OfflineTrack, "savedAt">; size?: "sm" | "md" }) {
  const snapshot = useSyncExternalStore(subscribeOffline, offlineSnapshot, () => "[]");
  const supported = useSyncExternalStore(
    () => () => {},
    () => offlineSupported(),
    () => false,
  );
  const saved = (JSON.parse(snapshot) as OfflineTrack[]).some((t) => t.id === track.id);
  const [progress, setProgress] = useState<number | null>(null);

  if (!supported) return null;

  async function download() {
    setProgress(0);
    try {
      await downloadForOffline(track, (f) => setProgress(f));
      toast.success("Disponible hors ligne. Retrouvez-la dans « Écoute hors ligne ».");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    await removeOffline(track.id);
    toast.success("Retirée du mode hors ligne.");
  }

  if (progress !== null) {
    return (
      <Button variant="outline" size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" /> {Math.round(progress * 100)} %
      </Button>
    );
  }
  if (saved) {
    return (
      <Button variant="outline" size={size} onClick={remove} title="Retirer du mode hors ligne" className="text-success">
        <CheckCircle2 className="h-4 w-4" /> Hors ligne
        <Trash2 className="ml-1 h-3.5 w-3.5 opacity-60" />
      </Button>
    );
  }
  return (
    <Button variant="outline" size={size} onClick={download} title="Télécharger pour écouter sans connexion">
      <CloudDownload className="h-4 w-4" /> Hors ligne
    </Button>
  );
}
