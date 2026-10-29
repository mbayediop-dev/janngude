"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TimerReset, AlertTriangle, ArrowLeft } from "lucide-react";
import { QuizRunner } from "@/components/share/quiz-runner";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client";
import { cn, formatDuration } from "@/lib/utils";
import type { ExamRow, GradeResult } from "@/lib/supabase/types";
import { Khadija } from "@/components/brand/khadija";

type Result = GradeResult & { byCourse: Record<string, { title: string; score: number; total: number }> };

/** Examen chronométré : compte à rebours, envoi automatique à la fin du temps, bilan par cours. */
export function ExamRunner({ exam }: { exam: ExamRow }) {
  const [started, setStarted] = useState(false);
  const [remaining, setRemaining] = useState(exam.duration_minutes * 60);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef<number>(0);
  const answersRef = useRef<(number | null)[]>(exam.questions.map(() => null));
  const submittingRef = useRef(false);

  async function submit(answers: (number | null)[]): Promise<GradeResult> {
    submittingRef.current = true;
    const timeSpent = Math.floor((Date.now() - startedAt.current) / 1000);
    const r = await apiJson<Result>(`/api/exams/${exam.id}/attempts`, { method: "POST", body: JSON.stringify({ answers, timeSpentSeconds: timeSpent }) });
    setResult(r);
    return r;
  }

  // Compte à rebours ; à zéro, les réponses en cours sont envoyées automatiquement.
  useEffect(() => {
    if (!started || result) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      const left = exam.duration_minutes * 60 - elapsed;
      setRemaining(Math.max(0, left));
      if (left <= 0 && !submittingRef.current) {
        window.clearInterval(timer);
        toast.warning("Temps écoulé : vos réponses sont envoyées.");
        void submit(answersRef.current).catch((err) => toast.error(err instanceof Error ? err.message : "Erreur"));
      }
    }, 500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, result, exam.duration_minutes]);

  if (!started) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] bg-surface p-8 shadow-card">
        <h2 className="text-[26px] font-semibold tracking-tight text-ink">{exam.title}</h2>
        <ul className="mt-4 space-y-2 text-[15px] text-ink-2">
          <li>• {exam.questions.length} questions à choix multiples</li>
          <li>• {exam.duration_minutes} minutes, chronomètre lancé au départ</li>
          <li>• Cours : {Array.from(new Set(exam.questions.map((q) => q.course_title))).join(", ")}</li>
          <li>• À la fin du temps, les réponses sont envoyées automatiquement</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            size="lg"
            onClick={() => {
              startedAt.current = Date.now();
              setStarted(true);
            }}
          >
            Commencer l’examen
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/app/exams">Retour</Link>
          </Button>
        </div>
      </div>
    );
  }

  const low = remaining <= 60 && !result;
  return (
    <div className="space-y-5">
      <div className={cn("sticky top-0 z-20 flex items-center justify-between gap-3 rounded-full px-5 py-3 shadow-float", low ? "bg-danger-soft text-danger" : result ? "bg-mint text-primary-ink" : "bg-ink text-white")}>
        <span className="flex items-center gap-2 text-sm font-medium">
          {low ? <AlertTriangle className="h-4 w-4" /> : <TimerReset className="h-4 w-4" />}
          {result ? "Examen terminé" : "Temps restant"}
        </span>
        <span className="text-[22px] font-semibold tabular-nums">{result ? formatDuration(exam.duration_minutes * 60 - remaining) : formatDuration(remaining)}</span>
      </div>

      <QuizRunner
        questions={exam.questions.map((q) => ({ question: q.question, options: q.options }))}
        labels={exam.questions.map((q) => q.course_title)}
        onChange={(answers) => {
          answersRef.current = answers;
        }}
        onSubmit={(answers) => {
          answersRef.current = answers;
          return submit(answers);
        }}
        footer={
          result ? (
            <div className="rounded-[28px] bg-surface p-6 shadow-card">
              <div className="flex items-center gap-4">
                <Khadija pose={result.score / Math.max(1, result.total) >= 0.7 ? "graduate" : "encourage"} className="h-24 w-24" />
                <div>
                  <h3 className="text-[18px] font-semibold text-ink">Bilan par cours</h3>
                  <p className="text-sm text-muted">{result.score / Math.max(1, result.total) >= 0.7 ? "Examen réussi : continuez sur cette lancée." : "Reprenez les cours signalés, puis repassez l’examen."}</p>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.values(result.byCourse).map((c) => {
                  const pct = Math.round((c.score / Math.max(1, c.total)) * 100);
                  return (
                    <li key={c.title} className={cn("flex items-center justify-between rounded-2xl px-4 py-3 text-sm", pct >= 70 ? "bg-mint" : pct >= 40 ? "bg-lemon" : "bg-danger-soft")}>
                      <span className="font-medium text-ink">{c.title}</span>
                      <span className="tabular-nums text-ink-2">
                        {c.score}/{c.total} · {pct} %
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/app/exams">
                  <ArrowLeft className="h-4 w-4" /> Tous les examens
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
