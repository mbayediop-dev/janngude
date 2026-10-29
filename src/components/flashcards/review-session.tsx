"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { apiJson } from "@/lib/client";
import { cn } from "@/lib/utils";
import { previewIntervals } from "@/lib/srs";
import type { FlashcardRow } from "@/lib/supabase/types";
import { Khadija, KhadijaFigure } from "@/components/brand/khadija";

export type ReviewCard = FlashcardRow & { course_title?: string };

const COLORS = ["bg-lemon", "bg-mint", "bg-sky", "bg-pink", "bg-lavender", "bg-violet"];

/** Session de révision : carte recto/verso, auto-évaluation en quatre niveaux, planification SM-2. */
export function ReviewSession({ cards, title, backHref }: { cards: ReviewCard[]; title: string; backHref: string }) {
  const [queue, setQueue] = useState<ReviewCard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ total: number; again: number }>({ total: 0, again: 0 });
  const [lastGrade, setLastGrade] = useState<0 | 1 | 2 | 3 | null>(null);

  const card = queue[index];
  const intervals = useMemo(() => (card ? previewIntervals(card) : null), [card]);
  const finished = !card;
  const progress = queue.length ? (index / queue.length) * 100 : 100;
  // Mot de Khadija selon l’étape : question, réponse, ou réaction à la dernière auto-évaluation.
  const hint = flipped
    ? { pose: "idea" as const, text: "Comment ça s’est passé ? Votre réponse fixe la prochaine date de révision de cette carte." }
    : lastGrade === 0
      ? { pose: "encourage" as const, text: "Pas grave : cette carte reviendra en fin de session. Carte suivante !" }
      : lastGrade === 3
        ? { pose: "thumbsup" as const, text: "Facile ! On enchaîne." }
        : { pose: "think" as const, text: "Répondez dans votre tête, puis retournez la carte pour vous évaluer." };

  async function grade(g: 0 | 1 | 2 | 3) {
    if (!card || saving) return;
    setSaving(true);
    try {
      await apiJson(`/api/flashcards/${card.id}/review`, { method: "POST", body: JSON.stringify({ grade: g }) });
      setDone((d) => ({ total: d.total + 1, again: d.again + (g === 0 ? 1 : 0) }));
      setLastGrade(g);
      // « Encore » : la carte revient en fin de session.
      if (g === 0) setQueue((q) => [...q, { ...card, repetitions: 0 }]);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] bg-surface p-8 text-center shadow-card">
        <Khadija pose={done.again ? "thumbsup" : "cheer"} className="mx-auto h-40 w-40" />
        <h2 className="mt-4 text-[26px] font-semibold tracking-tight text-ink">Session terminée 🎉</h2>
        <p className="mt-2 text-[15px] text-muted">
          {done.total ? `${done.total} carte${done.total > 1 ? "s" : ""} revue${done.total > 1 ? "s" : ""}${done.again ? `, dont ${done.again} à retravailler` : ""}.` : "Aucune carte à réviser pour le moment."} Les prochaines dates sont planifiées selon vos réponses.
        </p>
        <Button asChild className="mt-6">
          <Link href={backHref}>Retour</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-muted">
          {title} · carte {index + 1} / {queue.length}
        </p>
        <Progress value={progress} className="w-full sm:max-w-48" />
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_232px] md:items-start">
        <div>
      {/* Carte : clic pour retourner */}
      <button
        type="button"
        onClick={() => {
          setFlipped((f) => !f);
          setLastGrade(null);
        }}
        className={cn(
          "relative block min-h-[320px] w-full rounded-[28px] p-8 text-left shadow-[0_22px_34px_-20px_rgb(18_18_18/0.45)] transition-transform duration-200 active:scale-[0.99] sm:p-10",
          flipped ? "bg-surface" : COLORS[index % COLORS.length],
        )}
        aria-live="polite"
      >
        <span aria-hidden className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 -rotate-2 rounded-[2px] bg-white/55 shadow-[0_1px_2px_rgb(18_18_18/0.15)]" />
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink/60">
          {flipped ? "Réponse" : "Question"}
          {card.course_title ? ` · ${card.course_title}` : ""}
        </p>
        <p className={cn("mt-4 leading-snug text-ink", flipped ? "text-[20px] sm:text-[22px]" : "text-[24px] font-semibold sm:text-[28px]")}>{flipped ? card.back : card.front}</p>
        {!flipped ? (
          <span className="absolute bottom-6 right-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/70">
            Voir la réponse <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <span className="absolute bottom-6 right-8 inline-flex items-center gap-1.5 text-[13px] text-muted">
            <RotateCcw className="h-3.5 w-3.5" /> Revoir la question
          </span>
        )}
      </button>

      {flipped && intervals ? (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([0, 1, 2, 3] as const).map((g) => (
            <button
              key={g}
              type="button"
              disabled={saving}
              onClick={() => grade(g)}
              className={cn(
                "rounded-2xl px-3 py-3 text-center transition-transform hover:-translate-y-0.5 disabled:opacity-60",
                g === 0 ? "bg-danger-soft text-danger" : g === 1 ? "bg-lemon text-[#6b4d00]" : g === 2 ? "bg-sky text-info" : "bg-mint text-primary-ink",
              )}
            >
              <span className="block text-[15px] font-semibold">{["Encore", "Difficile", "Bien", "Facile"][g]}</span>
              <span className="block text-[12px] opacity-80">{intervals[g]}</span>
            </button>
          ))}
        </div>
      ) : null}
        </div>

        {/* Khadija à côté de la carte : bulle au-dessus d’elle sur grand écran, à côté d’elle sur téléphone */}
        <KhadijaFigure layout="auto" pose={hint.pose} size="md">
          {hint.text}
        </KhadijaFigure>
      </div>
    </div>
  );
}
