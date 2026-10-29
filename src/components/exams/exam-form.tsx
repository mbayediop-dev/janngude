"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TimerReset, Check, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/input";
import { apiJson } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { ExamRow, QuizDifficulty } from "@/lib/supabase/types";

const DIFFICULTY_LABEL: Record<QuizDifficulty, string> = { easy: "Facile", medium: "Intermédiaire", hard: "Difficile" };

export function ExamForm({ courses }: { courses: { id: string; title: string; domain: string; subject: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState<"10" | "20" | "30" | "40">("20");
  const [duration, setDuration] = useState<"15" | "30" | "45" | "60">("30");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]));
  }

  async function create() {
    if (!selected.length) return toast.error("Choisissez au moins un cours.");
    setCreating(true);
    try {
      const exam = await apiJson<ExamRow>("/api/exams", {
        method: "POST",
        body: JSON.stringify({ courseIds: selected, count: Number(count), durationMinutes: Number(duration), difficulty, title: title.trim() || undefined }),
      });
      toast.success("Examen prêt.");
      router.push(`/app/exams/${exam.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setCreating(false);
    }
  }

  return (
    <div className="rounded-[28px] bg-surface p-6 shadow-card sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lemon text-ink">
          <TimerReset className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">Nouvel examen blanc</h2>
          <p className="mt-0.5 text-sm text-muted">Les questions de chaque cours sont mélangées et chronométrées, avec un bilan par cours à la fin.</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Cours</Label>
            <span className="text-[12px] text-muted">
              {selected.length} / 8 sélectionné{selected.length > 1 ? "s" : ""}
            </span>
          </div>
          {courses.length ? (
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
              {courses.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    className={cn("inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-left text-[13px] font-medium transition-colors", on ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}
                  >
                    <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", on ? "bg-white text-ink" : "bg-surface text-muted")}>{on ? <Check className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}</span>
                    <span className="truncate">{c.title}</span>
                    <span className={cn("shrink-0 text-[11px]", on ? "text-white/60" : "text-muted")}>· {c.subject}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-lemon px-4 py-3 text-[13px] text-[#6b4d00]">Aucun cours analysé pour l’instant : déposez un cours, puis revenez créer un examen.</p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <ChipGroup label="Nombre de questions" value={count} onChange={setCount} options={[{ value: "10", label: "10" }, { value: "20", label: "20" }, { value: "30", label: "30" }, { value: "40", label: "40" }]} />
          <ChipGroup label="Durée" value={duration} onChange={setDuration} options={[{ value: "15", label: "15 min" }, { value: "30", label: "30 min" }, { value: "45", label: "45 min" }, { value: "60", label: "1 h" }]} />
        </div>
        <ChipGroup label="Niveau" value={difficulty} onChange={setDifficulty} options={[{ value: "easy", label: "Facile" }, { value: "medium", label: "Intermédiaire" }, { value: "hard", label: "Difficile" }]} />

        <div>
          <Label htmlFor="exam-title">Titre (facultatif)</Label>
          <Input id="exam-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Partiel de droit civil — semestre 1" maxLength={140} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-ink p-2 pl-5 text-white">
          <div className="min-w-0 py-2">
            <p className="text-[15px] font-semibold">
              {count} questions · {duration === "60" ? "1 h" : `${duration} min`} · {DIFFICULTY_LABEL[difficulty]}
            </p>
            <p className="text-[12px] text-white/60">{selected.length ? `${selected.length} cours sélectionné${selected.length > 1 ? "s" : ""}` : "Sélectionnez au moins un cours"}</p>
          </div>
          <Button variant="white" size="lg" onClick={create} loading={creating} disabled={!selected.length}>
            {creating ? "Préparation des questions…" : "Créer l’examen"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Choix exclusif en pastilles qui se replient sans se casser (au lieu d’une barre segmentée). */
function ChipGroup<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div>
      <Label className="mb-2">{label}</Label>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("h-10 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors", value === o.value ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
