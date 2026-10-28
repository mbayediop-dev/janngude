"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { CourseStatus } from "@/lib/supabase/types";

const STEPS = ["Lecture du document", "Extraction des grandes lignes", "Repérage des informations à retenir", "Préparation de votre espace de révision"];

export function ProcessingView({ courseId, title, status, errorMessage, autoTitle }: { courseId: string; title: string; status: CourseStatus; errorMessage: string | null; autoTitle: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(status === "error" ? errorMessage : null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(status !== "error");
  const runRef = useRef(false);

  async function runAnalyze() {
    if (runRef.current) return;
    runRef.current = true;
    try {
      await apiJson(`/api/courses/${courseId}/analyze`, { method: "POST", body: JSON.stringify({ autoTitle }) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setRunning(false);
    } finally {
      runRef.current = false;
    }
  }

  function retry() {
    setError(null);
    setRunning(true);
    setElapsed(0);
    void runAnalyze();
  }

  // Lance l’analyse pour un cours fraîchement déposé. `runRef` évite un double appel
  // (React monte les effets deux fois en développement) et le serveur ignore de toute
  // façon une demande si l’analyse est déjà en cours.
  useEffect(() => {
    // Pas de nettoyage volontairement : en développement, React démonte/remonte l’effet
    // immédiatement, ce qui annulerait le déclenchement ; `runRef` absorbe le doublon.
    if (status === "uploaded") window.setTimeout(() => void runAnalyze(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, status]);

  // Chronomètre + vérification périodique du statut (si l’onglet a été rechargé).
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    const poll = window.setInterval(async () => {
      try {
        const data = await apiJson<{ status: CourseStatus; error_message: string | null }>(`/api/courses/${courseId}`);
        if (data.status === "ready") router.refresh();
        if (data.status === "error") {
          setError(data.error_message ?? "L’analyse a échoué.");
          setRunning(false);
        }
      } catch {
        /* nouvelle tentative au prochain tick */
      }
    }, 4000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(poll);
    };
  }, [running, courseId, router]);

  const currentStep = Math.min(STEPS.length - 1, Math.floor(elapsed / 12));

  return (
    <div className="mx-auto max-w-xl py-10">
      <Link href="/app" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Mes cours
      </Link>
      <div className="rounded-[28px] bg-surface p-8 shadow-float">
        {error ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight text-ink">L’analyse n’a pas abouti</h1>
            <p className="mt-2 text-sm text-ink-2">{error}</p>
            <div className="mt-6 flex gap-2">
              <Button onClick={retry}>Réessayer</Button>
              <Button asChild variant="outline">
                <Link href="/app">Retour</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-ink">
              <Loader2 className="h-6 w-6 animate-spin" />
            </span>
            <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight text-ink">Analyse de « {title} »</h1>
            <p className="mt-2 text-sm text-muted">Quelques dizaines de secondes à quelques minutes selon la taille du document. Vous pouvez rester sur cette page.</p>
            <ol className="mt-7 space-y-3">
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <li key={step} className={cn("flex items-center gap-3 text-sm", done ? "text-muted" : active ? "text-ink" : "text-muted/70")}>
                    {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : active ? <Loader2 className="h-5 w-5 animate-spin text-ink" /> : <Circle className="h-5 w-5" />}
                    {step}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
