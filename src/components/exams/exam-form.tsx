"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { apiJson } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { ExamRow, QuizDifficulty } from "@/lib/supabase/types";

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
    <div className="rounded-[28px] bg-surface p-7 shadow-card">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <TimerReset className="h-4 w-4" /> Nouvel examen blanc
      </h2>
      <p className="mt-1 text-sm text-muted">Choisissez un ou plusieurs cours : les questions seront mélangées et chronométrées, avec un bilan par cours à la fin.</p>

      <div className="mt-5 space-y-5">
        <div>
          <Label>
            Cours ({selected.length} sélectionné{selected.length > 1 ? "s" : ""}, 8 maximum)
          </Label>
          {courses.length ? (
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
              {courses.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggle(c.id)} aria-pressed={on} className={cn("rounded-full px-3.5 py-2 text-left text-[13px] font-medium transition-colors", on ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}>
                    {c.title} <span className={cn("ml-1 text-[11px]", on ? "text-white/60" : "text-muted")}>· {c.subject}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">Aucun cours analysé pour l’instant.</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nombre de questions</Label>
            <Segmented
              value={count}
              onChange={setCount}
              options={[
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "30", label: "30" },
                { value: "40", label: "40" },
              ]}
            />
          </div>
          <div>
            <Label>Durée</Label>
            <Segmented
              value={duration}
              onChange={setDuration}
              options={[
                { value: "15", label: "15 min" },
                { value: "30", label: "30 min" },
                { value: "45", label: "45 min" },
                { value: "60", label: "1 h" },
              ]}
            />
          </div>
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
          <Label htmlFor="exam-title">Titre (facultatif)</Label>
          <Input id="exam-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Partiel de droit civil — semestre 1" maxLength={140} />
        </div>
        <Button size="lg" onClick={create} loading={creating} disabled={!selected.length}>
          {creating ? "Préparation des questions…" : "Créer l’examen"}
        </Button>
      </div>
    </div>
  );
}
