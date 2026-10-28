"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Layers, Trash2, Play, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Segmented, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { apiJson } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import type { FlashcardRow } from "@/lib/supabase/types";

const COLORS = ["bg-lemon", "bg-mint", "bg-sky", "bg-pink", "bg-lavender", "bg-violet"];

export function FlashcardsPanel({ courseId, initialCards, now }: { courseId: string; initialCards: FlashcardRow[]; now: string }) {
  const [cards, setCards] = useState(initialCards);
  const [count, setCount] = useState<"10" | "20" | "30">("20");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ front: "", back: "" });

  const nowMs = new Date(now).getTime();
  const due = cards.filter((c) => new Date(c.due_at).getTime() <= nowMs);
  const learned = cards.filter((c) => c.repetitions >= 3);

  async function generate() {
    setGenerating(true);
    try {
      const data = await apiJson<{ cards: FlashcardRow[] }>(`/api/courses/${courseId}/flashcards`, { method: "POST", body: JSON.stringify({ count: Number(count) }) });
      setCards((c) => [...data.cards, ...c]);
      toast.success(`${data.cards.length} cartes créées.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiJson(`/api/flashcards/${id}`, { method: "DELETE" });
      setCards((c) => c.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function removeAll() {
    if (!confirm("Supprimer toutes les cartes de ce cours et leur historique ?")) return;
    try {
      await apiJson(`/api/courses/${courseId}/flashcards`, { method: "DELETE" });
      setCards([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  function startEdit(card: FlashcardRow) {
    setEditing(card.id);
    setDraft({ front: card.front, back: card.back });
  }

  async function saveEdit(id: string) {
    try {
      await apiJson(`/api/flashcards/${id}`, { method: "PATCH", body: JSON.stringify(draft) });
      setCards((c) => c.map((x) => (x.id === id ? { ...x, front: draft.front.trim(), back: draft.back.trim() } : x)));
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="rounded-[28px] bg-surface p-7 shadow-card">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Layers className="h-4 w-4" /> Cartes mémoire
          </h2>
          <p className="mt-1 text-sm text-muted">Des questions-réponses tirées du cours, à réviser par répétition espacée : chaque carte revient au bon moment selon vos réponses.</p>
          <div className="mt-5 space-y-4">
            <div>
              <Label>Nombre de cartes à créer</Label>
              <Segmented
                value={count}
                onChange={setCount}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "30", label: "30" },
                ]}
              />
            </div>
            <Button size="lg" onClick={generate} loading={generating}>
              {generating ? "Création des cartes…" : cards.length ? "Ajouter des cartes" : "Créer les cartes"}
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] bg-mint p-7">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-primary-ink/70">Aujourd’hui</p>
          <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight text-ink">{due.length}</p>
          <p className="mt-1 text-[15px] text-ink/80">
            {due.length ? `carte${due.length > 1 ? "s" : ""} à réviser sur ce cours` : cards.length ? "Rien à réviser pour ce cours aujourd’hui." : "Créez des cartes pour commencer."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-ink/80">
            <Badge tone="neutral" className="bg-white/70">
              {cards.length} carte{cards.length > 1 ? "s" : ""}
            </Badge>
            <Badge tone="neutral" className="bg-white/70">
              {learned.length} maîtrisée{learned.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {due.length ? (
              <Button asChild>
                <Link href={`/app/review?course=${courseId}`}>
                  <Play className="h-4 w-4" /> Réviser maintenant
                </Link>
              </Button>
            ) : null}
            {cards.length ? (
              <Button asChild variant="white">
                <Link href={`/app/review?course=${courseId}&all=1`}>Tout revoir</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState icon={<Layers />} title="Aucune carte pour l’instant" description="Créez des cartes mémoire à partir du cours : elles reviendront au bon moment pour être mémorisées durablement." />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-medium uppercase tracking-wider text-muted">Toutes les cartes</p>
            <Button variant="ghost" size="sm" onClick={removeAll}>
              <Trash2 className="h-4 w-4" /> Tout supprimer
            </Button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, i) => {
              const isDue = new Date(card.due_at).getTime() <= nowMs;
              return (
                <li key={card.id} className={cn("relative rounded-[22px] p-5", COLORS[i % COLORS.length])}>
                  {editing === card.id ? (
                    <div className="space-y-2">
                      <Textarea value={draft.front} onChange={(e) => setDraft((d) => ({ ...d, front: e.target.value }))} className="min-h-16 bg-white/80" aria-label="Question" />
                      <Textarea value={draft.back} onChange={(e) => setDraft((d) => ({ ...d, back: e.target.value }))} className="min-h-20 bg-white/80" aria-label="Réponse" />
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => saveEdit(card.id)}>
                          <Check className="h-4 w-4" /> Enregistrer
                        </Button>
                        <Button size="sm" variant="white" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" /> Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="pr-16 text-[15px] font-semibold leading-snug text-ink">{card.front}</p>
                      <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{card.back}</p>
                      <p className="mt-3 text-[12px] text-ink/60">
                        {card.repetitions ? `${card.repetitions} révision${card.repetitions > 1 ? "s" : ""} · ` : ""}
                        {isDue ? "à réviser" : `prochaine le ${formatDate(card.due_at)}`}
                      </p>
                      <div className="absolute right-3 top-3 flex gap-1">
                        <button type="button" onClick={() => startEdit(card)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-ink hover:bg-white" aria-label="Modifier">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => remove(card.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-ink hover:bg-white hover:text-danger" aria-label="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
