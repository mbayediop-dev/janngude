"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Share2, Download, Trash2, ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Segmented, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/share/share-dialog";
import { QuizRunner } from "@/components/share/quiz-runner";
import { apiJson } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import type { QuizRow, QuizDifficulty, GradeResult } from "@/lib/supabase/types";
import { Khadija } from "@/components/brand/khadija";

export type QuizWithAttempts = QuizRow & { attempts: { score: number; total: number; created_at: string }[] };

const DIFF_LABEL: Record<QuizDifficulty, string> = { easy: "Facile", medium: "Intermédiaire", hard: "Difficile" };
const DIFF_TONE: Record<QuizDifficulty, "success" | "accent" | "danger"> = { easy: "success", medium: "accent", hard: "danger" };

export function QuizPanel({ courseId, initialQuizzes }: { courseId: string; initialQuizzes: QuizWithAttempts[] }) {
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(initialQuizzes.length === 0);
  const [count, setCount] = useState<"5" | "10" | "15" | "20">("10");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [focus, setFocus] = useState("");
  const [generating, setGenerating] = useState(false);

  const open = quizzes.find((q) => q.id === openId) ?? null;

  async function generate() {
    setGenerating(true);
    try {
      const quiz = await apiJson<QuizRow>(`/api/courses/${courseId}/quizzes`, {
        method: "POST",
        body: JSON.stringify({ count: Number(count), difficulty, focus: focus.trim() || undefined }),
      });
      const row: QuizWithAttempts = { ...quiz, attempts: [] };
      setQuizzes((q) => [row, ...q]);
      setCreating(false);
      setOpenId(row.id);
      setFocus("");
      toast.success("Quiz prêt.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce quiz et ses résultats ?")) return;
    try {
      await apiJson(`/api/quizzes/${id}`, { method: "DELETE" });
      setQuizzes((q) => q.filter((x) => x.id !== id));
      if (openId === id) setOpenId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function submitAttempt(quiz: QuizWithAttempts, answers: (number | null)[]): Promise<GradeResult> {
    const result = await apiJson<GradeResult>(`/api/quizzes/${quiz.id}/attempts`, { method: "POST", body: JSON.stringify({ answers }) });
    setQuizzes((list) => list.map((q) => (q.id === quiz.id ? { ...q, attempts: [{ score: result.score, total: result.total, created_at: new Date().toISOString() }, ...q.attempts] } : q)));
    return result;
  }

  if (open) {
    const best = open.attempts.reduce((m, a) => Math.max(m, a.total ? a.score / a.total : 0), 0);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
            <ArrowLeft className="h-4 w-4" /> Tous les quiz
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/export/pdf?type=quiz&id=${open.id}`}>
                <Download className="h-4 w-4" /> PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/export/pdf?type=quiz&id=${open.id}&answers=1`}>
                <Download className="h-4 w-4" /> PDF avec corrigé
              </a>
            </Button>
            <ShareDialog
              type="quiz"
              id={open.id}
              title={open.title}
              downloads={[
                { label: "PDF (questions)", href: `/api/export/pdf?type=quiz&id=${open.id}` },
                { label: "PDF (corrigé)", href: `/api/export/pdf?type=quiz&id=${open.id}&answers=1` },
              ]}
              trigger={
                <Button size="sm">
                  <Share2 className="h-4 w-4" /> Partager
                </Button>
              }
            />
          </div>
        </div>
        <div>
          <h2 className="text-[26px] font-semibold tracking-tight text-ink">{open.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone={DIFF_TONE[open.difficulty]}>{DIFF_LABEL[open.difficulty]}</Badge>
            <span>{open.questions.length} questions</span>
            {open.attempts.length ? (
              <span>
                · {open.attempts.length} tentative(s) · meilleur score {Math.round(best * 100)} %
              </span>
            ) : null}
          </p>
        </div>
        <QuizRunner key={open.id} questions={open.questions.map((q) => ({ question: q.question, options: q.options }))} onSubmit={(answers) => submitAttempt(open, answers)} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className={cn("rounded-[28px] bg-surface p-7 shadow-card", !creating && "hidden lg:block")}>
        <h2 className="flex items-center gap-3 text-base font-semibold text-ink">
          <Khadija pose="tablet" className="-my-2 h-14 w-14" /> Nouveau quiz
        </h2>
        <p className="mt-1 text-sm text-muted">Des questions à choix multiples sur l’ensemble du cours, avec les bonnes réponses et leurs explications après l’épreuve.</p>
        <div className="mt-5 space-y-4">
          <div>
            <Label>Nombre de questions</Label>
            <Segmented
              value={count}
              onChange={setCount}
              options={[
                { value: "5", label: "5" },
                { value: "10", label: "10" },
                { value: "15", label: "15" },
                { value: "20", label: "20" },
              ]}
            />
          </div>
          <div>
            <Label>Niveau</Label>
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: "easy", label: "Facile" },
                { value: "medium", label: "Intermédiaire" },
                { value: "hard", label: "Difficile" },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="quiz-focus">Thème à privilégier (facultatif)</Label>
            <Input id="quiz-focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex. chapitre 2, les exceptions" maxLength={200} />
          </div>
          <Button size="lg" onClick={generate} loading={generating}>
            {generating ? "Préparation des questions…" : "Créer le quiz"}
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        {quizzes.length === 0 ? (
          <EmptyState icon={<Trophy />} title="Aucun quiz pour l’instant" description="Créez un quiz pour vérifier votre maîtrise du cours." action={<Button className="lg:hidden" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouveau quiz</Button>} />
        ) : (
          <ul className="space-y-3">
            <li className="lg:hidden">
              <Button variant="outline" className="w-full" onClick={() => setCreating((c) => !c)}>
                <Plus className="h-4 w-4" /> Nouveau quiz
              </Button>
            </li>
            {quizzes.map((q) => {
              const best = q.attempts.reduce((m, a) => Math.max(m, a.total ? a.score / a.total : 0), 0);
              return (
                <li key={q.id} className="flex items-center gap-4 rounded-[22px] bg-surface p-5 shadow-card transition-colors hover:border-line-strong">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(q.id)}>
                    <p className="truncate text-[15px] font-medium text-ink">{q.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      <Badge tone={DIFF_TONE[q.difficulty]}>{DIFF_LABEL[q.difficulty]}</Badge>
                      <span>{q.questions.length} questions</span>
                      <span>· {formatDate(q.created_at)}</span>
                      {q.attempts.length ? <span>· meilleur score {Math.round(best * 100)} %</span> : null}
                    </p>
                  </button>
                  <Button size="sm" onClick={() => setOpenId(q.id)}>
                    {q.attempts.length ? "Refaire" : "Commencer"}
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove(q.id)} aria-label="Supprimer le quiz">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
