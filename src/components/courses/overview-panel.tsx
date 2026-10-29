"use client";

import { useState } from "react";
import { Dialog as D } from "radix-ui";
import { FileText, ListChecks, Headphones, MessagesSquare, Lightbulb, ListTree, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OutlineSection, KeyPoint } from "@/lib/supabase/types";

type View = "outline" | "keypoints";

const COLORS = ["bg-lemon", "bg-mint", "bg-sky", "bg-pink", "bg-lavender", "bg-violet"];
const TILTS = ["-rotate-[1.2deg]", "rotate-[0.8deg]", "-rotate-[0.5deg]", "rotate-[1.4deg]", "-rotate-[1.6deg]", "rotate-[0.4deg]"];

/** Contenu d’une note, commun à la grille et à la vue agrandie. */
type Note = { number?: string; title: string; points?: string[]; detail?: string; colorIndex: number };

export function OverviewPanel({
  overview,
  outline,
  keyPoints,
  keywords,
  onNavigate,
  initialView = "outline",
  initialExpanded = null,
}: {
  overview: string | null;
  outline: OutlineSection[];
  keyPoints: KeyPoint[];
  keywords: string[];
  onNavigate: (tab: "summaries" | "audio" | "quiz" | "chat") => void;
  initialView?: View;
  initialExpanded?: number | null;
}) {
  const [view, setView] = useState<View>(initialView);
  const [expanded, setExpanded] = useState<number | null>(initialExpanded);

  const notes: Note[] =
    view === "outline"
      ? outline.map((s, i) => ({ number: String(i + 1).padStart(2, "0"), title: s.title, points: s.points, colorIndex: i }))
      : keyPoints.map((k, i) => ({ title: k.title, detail: k.detail, colorIndex: i + 2 }));

  function switchView(next: View) {
    setView(next);
    setExpanded(null);
  }

  return (
    <div className="space-y-8">
      {overview ? <p className="max-w-3xl text-[17px] leading-relaxed text-ink-2">{overview}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onNavigate("summaries")}>
          <FileText className="h-4 w-4" /> Générer un résumé
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("quiz")}>
          <ListChecks className="h-4 w-4" /> Créer un quiz
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("audio")}>
          <Headphones className="h-4 w-4" /> Écouter le cours
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("chat")}>
          <MessagesSquare className="h-4 w-4" /> Poser une question
        </Button>
      </div>

      {/* Sélecteur : un seul des deux tableaux de post-it est affiché */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-surface p-1 shadow-card scrollbar-thin" role="tablist" aria-label="Contenu de l’aperçu">
          <ViewTab active={view === "outline"} onClick={() => switchView("outline")} icon={<ListTree className="h-4 w-4" />} label="Grandes lignes" count={outline.length} />
          <ViewTab active={view === "keypoints"} onClick={() => switchView("keypoints")} icon={<Lightbulb className="h-4 w-4" />} label="À retenir" count={keyPoints.length} />
        </div>
        {keywords.length ? (
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <span key={k} className="rounded-full bg-surface px-3 py-1.5 text-[13px] text-ink-2 shadow-card">
                {k}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div role="tabpanel" className="grid gap-7 px-1 pt-3 sm:grid-cols-2 xl:grid-cols-3">
        {notes.map((note, i) => (
          <PostIt key={`${view}-${i}`} note={note} tilt={TILTS[i % TILTS.length]} onExpand={() => setExpanded(i)} />
        ))}
      </div>

      <ExpandedNote notes={notes} index={expanded} onChange={setExpanded} />
    </div>
  );
}

function ViewTab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors sm:px-4", active ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
    >
      {icon}
      {label}
      <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-white/20 text-white" : "bg-surface-2 text-muted")}>{count}</span>
    </button>
  );
}

function NoteBody({ note, large }: { note: Note; large?: boolean }) {
  return (
    <>
      <div className="flex items-baseline gap-3">
        {note.number ? <span className={cn("font-semibold leading-none tracking-tight text-ink/70", large ? "text-[40px]" : "text-[28px]")}>{note.number}</span> : null}
        <h3 className={cn("font-semibold leading-snug text-ink", large ? "text-[26px] sm:text-[30px]" : "text-[18px]")}>{note.title}</h3>
      </div>
      {note.points ? (
        <ul className={cn("space-y-2", large ? "mt-6 space-y-3" : "mt-4")}>
          {note.points.map((p, j) => (
            <li
              key={j}
              className={cn(
                "relative pl-5 leading-relaxed text-ink/85 before:absolute before:left-0 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ink/40",
                large ? "text-[18px] before:top-[0.7em] sm:text-[19px]" : "text-[15px] before:top-[0.62em]",
              )}
            >
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      {note.detail ? <p className={cn("leading-relaxed text-ink/85", large ? "mt-5 text-[19px] sm:text-[21px]" : "mt-3 text-[15px]")}>{note.detail}</p> : null}
    </>
  );
}

/** Post-it pastel : léger angle, adhésif en haut, coin replié ; se redresse au survol ; un clic l’agrandit. */
function PostIt({ note, tilt, onExpand }: { note: Note; tilt: string; onExpand: () => void }) {
  const color = COLORS[note.colorIndex % COLORS.length];
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      }}
      aria-label={`Agrandir : ${note.title}`}
      className={cn(
        "group relative min-h-[200px] cursor-zoom-in rounded-[10px] px-6 pb-8 pt-8 shadow-[0_22px_34px_-20px_rgb(18_18_18/0.45),0_2px_6px_rgb(18_18_18/0.06)] outline-none transition-[transform,box-shadow] duration-200 hover:z-10 hover:rotate-0 hover:-translate-y-1 hover:shadow-[0_28px_40px_-20px_rgb(18_18_18/0.5)] focus-visible:ring-2 focus-visible:ring-ink",
        color,
        tilt,
      )}
    >
      <span aria-hidden className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 -rotate-2 rounded-[2px] bg-white/55 shadow-[0_1px_2px_rgb(18_18_18/0.15)] backdrop-blur-[1px]" />
      <span aria-hidden className="absolute bottom-0 right-0 h-8 w-8 rounded-br-[10px] rounded-tl-[8px] bg-[linear-gradient(225deg,var(--paper)_50%,rgb(18_18_18/0.14)_50%)]" />
      <span
        aria-hidden
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-ink opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Maximize2 className="h-4 w-4" />
      </span>
      <NoteBody note={note} />
    </article>
  );
}

/** Vue agrandie d’une note, avec navigation entre les notes (flèches, clavier). */
function ExpandedNote({ notes, index, onChange }: { notes: Note[]; index: number | null; onChange: (i: number | null) => void }) {
  const open = index !== null && index >= 0 && index < notes.length;
  const note = open ? notes[index] : null;
  const color = note ? COLORS[note.colorIndex % COLORS.length] : "";
  const prev = () => open && onChange((index + notes.length - 1) % notes.length);
  const next = () => open && onChange((index + 1) % notes.length);

  return (
    <D.Root open={open} onOpenChange={(o) => !o && onChange(null)}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <D.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") prev();
            if (e.key === "ArrowRight") next();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none sm:p-8"
        >
          {note ? (
            <div className="w-full max-w-3xl animate-rise">
              <D.Title className="sr-only">{note.title}</D.Title>
              {/* L’ombre est portée par un calque limité à la note (le clip-path de la note la supprimerait) ; il ne capte aucun clic. */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-[14px] shadow-pop" aria-hidden />
                <article
                  className={cn(
                    "relative rounded-[14px] px-8 pb-12 pt-12 [clip-path:polygon(0_0,100%_0,100%_calc(100%-48px),calc(100%-48px)_100%,0_100%)] sm:px-12 sm:pb-14 sm:pt-14",
                    color,
                  )}
                >
                  <span aria-hidden className="absolute -top-4 left-1/2 h-9 w-40 -translate-x-1/2 -rotate-2 rounded-[2px] bg-white/55 shadow-[0_1px_2px_rgb(18_18_18/0.15)] backdrop-blur-[1px]" />
                  <span aria-hidden className="absolute bottom-0 right-0 h-12 w-12 bg-[linear-gradient(225deg,transparent_50%,rgb(18_18_18/0.16)_50%)]" />
                  <D.Close className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink shadow-card transition-colors hover:bg-white" aria-label="Fermer">
                    <X className="h-5 w-5" />
                  </D.Close>
                  <NoteBody note={note} large />
                </article>
              </div>

              {notes.length > 1 ? (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button type="button" onClick={prev} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-float transition-transform hover:scale-105" aria-label="Note précédente">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="rounded-full bg-white/90 px-4 py-2 text-[13px] font-semibold tabular-nums text-ink shadow-card">
                    {(index ?? 0) + 1} / {notes.length}
                  </span>
                  <button type="button" onClick={next} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-float transition-transform hover:scale-105" aria-label="Note suivante">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
