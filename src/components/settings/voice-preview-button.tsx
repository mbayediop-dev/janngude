"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Un seul extrait à la fois dans la page : l’élément audio partagé et la fonction d’arrêt de l’extrait en cours. */
let current: { audio: HTMLAudioElement; stop: () => void } | null = null;

/** Bouton « Écouter » : lit l’extrait d’une voix (`/api/voices/<id>/preview`, `default` pour la voix par défaut). */
export function VoicePreviewButton({ voiceId, label = "Écouter", variant = "white", size = "sm", className }: { voiceId: string; label?: string; variant?: "white" | "outline" | "ghost" | "secondary"; size?: "sm" | "md"; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function stop() {
    current?.stop();
  }

  async function play() {
    if (state === "playing") return stop();
    if (state === "loading") return;
    stop();
    setState("loading");
    try {
      if (!urlRef.current) {
        const res = await fetch(`/api/voices/${encodeURIComponent(voiceId)}/preview`);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Extrait indisponible.");
        }
        urlRef.current = URL.createObjectURL(await res.blob());
      }
      const audio = new Audio(urlRef.current);
      const finish = () => {
        if (current?.audio === audio) current = null;
        setState("idle");
      };
      audio.onended = finish;
      audio.onerror = finish;
      current = {
        audio,
        stop: () => {
          audio.pause();
          finish();
        },
      };
      await audio.play();
      setState("playing");
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : "Extrait indisponible.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={play} className={className} aria-label={state === "playing" ? "Arrêter l’extrait" : `${label} un extrait de cette voix`}>
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "playing" ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {state === "playing" ? "Arrêter" : label}
    </Button>
  );
}
