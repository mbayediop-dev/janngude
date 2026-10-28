"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import type { GradeResult } from "@/lib/supabase/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizRunner({
  questions,
  onSubmit,
  onChange,
  labels,
  footer,
}: {
  questions: { question: string; options: string[] }[];
  onSubmit: (answers: (number | null)[]) => Promise<GradeResult>;
  onChange?: (answers: (number | null)[]) => void;
  labels?: string[];
  footer?: React.ReactNode;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = useMemo(() => answers.filter((a) => a !== null).length, [answers]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      setResult(await onSubmit(answers));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setAnswers(questions.map(() => null));
    setResult(null);
  }

  const pct = result ? Math.round((result.score / Math.max(1, result.total)) * 100) : 0;

  return (
    <div className="space-y-6">
      {result ? (
        <div className="rounded-[28px] bg-surface p-7 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", pct >= 70 ? "bg-success-soft text-success" : pct >= 40 ? "bg-accent-soft text-[#7a4c00]" : "bg-danger-soft text-danger")}>
                <Trophy className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[32px] font-semibold leading-none tracking-tight text-ink">
                  {result.score} / {result.total}
                </p>
                <p className="mt-1 text-sm text-muted">{pct >= 70 ? "Très bonne maîtrise du cours." : pct >= 40 ? "C’est en bonne voie : relisez les points signalés." : "Reprenez le cours, puis retentez le quiz."}</p>
              </div>
            </div>
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="h-4 w-4" /> Recommencer
            </Button>
          </div>
          <Progress value={pct} className="mt-5" tone={pct >= 70 ? "success" : pct >= 40 ? "accent" : "danger"} />
        </div>
      ) : (
        <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-4 rounded-full bg-paper/90 px-1 py-2 backdrop-blur">
          <p className="text-sm text-muted">
            {answered} / {questions.length} réponses
          </p>
          <Progress value={(answered / Math.max(1, questions.length)) * 100} className="max-w-48" />
        </div>
      )}

      <ol className="space-y-4">
        {questions.map((q, i) => {
          const r = result?.results[i];
          return (
            <li key={i} className="rounded-[22px] bg-surface p-5 shadow-card">
              <p className="flex gap-3 text-[15px] font-medium leading-snug text-ink">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2">{i + 1}</span>
                <span>
                  {labels?.[i] ? <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{labels[i]}</span> : null}
                  {q.question}
                </span>
              </p>
              <div className="mt-4 grid gap-2">
                {q.options.map((opt, j) => {
                  const selected = answers[i] === j;
                  const isCorrect = r ? r.answer_index === j : false;
                  const isWrongSelected = r ? selected && !r.correct : false;
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={!!result}
                      onClick={() =>
                        setAnswers((a) => {
                          const next = a.map((v, k) => (k === i ? j : v));
                          onChange?.(next);
                          return next;
                        })
                      }
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                        !result && (selected ? "border-ink bg-lavender/70 text-ink" : "border-transparent bg-surface-2/70 hover:bg-surface-2"),
                        result && isCorrect && "border-success bg-success-soft text-ink",
                        result && isWrongSelected && "border-danger bg-danger-soft text-ink",
                        result && !isCorrect && !isWrongSelected && "border-line text-muted",
                      )}
                    >
                      <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", selected || isCorrect ? "bg-ink text-white" : "bg-surface-2 text-ink-2")}>
                        {LETTERS[j]}
                      </span>
                      <span className="flex-1 leading-snug">{opt}</span>
                      {result && isCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : null}
                      {result && isWrongSelected ? <XCircle className="h-5 w-5 shrink-0 text-danger" /> : null}
                    </button>
                  );
                })}
              </div>
              {r ? (
                <div className={cn("mt-4 rounded-2xl px-4 py-3 text-sm leading-relaxed", r.correct ? "bg-success-soft text-ink-2" : "bg-surface-2 text-ink-2")}>
                  <span className="font-medium text-ink">{r.correct ? "Bonne réponse. " : r.selected === null ? "Sans réponse. " : "Réponse attendue : " + LETTERS[r.answer_index] + ". "}</span>
                  {r.explanation}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}

      {!result ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-surface p-5 shadow-card">
          <p className="text-sm text-muted">{answered < questions.length ? `${questions.length - answered} question(s) sans réponse.` : "Toutes les questions ont une réponse."}</p>
          <Button size="lg" onClick={submit} loading={submitting}>
            Vérifier mes réponses
          </Button>
        </div>
      ) : (
        footer
      )}
    </div>
  );
}
