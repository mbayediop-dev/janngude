"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, LayoutGrid, List, Bell, ArrowRight, Inbox, Brain } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { CornerBubble } from "@/components/ui/misc";
import { DomainIcon } from "./domain-icon";
import { SharedCard } from "@/components/share/shared-card";
import type { CourseStatus, ReceivedShare } from "@/lib/supabase/types";

export type LibraryCourse = {
  id: string;
  title: string;
  domain: string;
  subject: string;
  status: CourseStatus;
  overview: string | null;
  created_at: string;
  updated_at: string;
  counts: { summaries: number; quizzes: number; audios: number; chats: number };
};

export function CourseLibrary({ courses, received, now, dueCards = 0 }: { courses: LibraryCourse[]; received: ReceivedShare[]; now: string; dueCards?: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [domain, setDomainState] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  function setDomain(value: string) {
    setDomainState(value);
    setSubject("all");
  }
  const nowDate = useMemo(() => new Date(now), [now]);

  const domains = useMemo(() => Array.from(new Set(courses.map((c) => c.domain))).sort((a, b) => a.localeCompare(b, "fr")), [courses]);

  const subjects = useMemo(
    () => (domain === "all" ? [] : Array.from(new Set(courses.filter((c) => c.domain === domain).map((c) => c.subject))).sort((a, b) => a.localeCompare(b, "fr"))),
    [courses, domain],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter(
      (c) =>
        (domain === "all" || c.domain === domain) &&
        (subject === "all" || c.subject === subject) &&
        (!q || [c.title, c.subject, c.domain, c.overview ?? ""].some((v) => v.toLowerCase().includes(q))),
    );
  }, [courses, query, domain, subject]);

  const stats = {
    total: courses.length,
    ready: courses.filter((c) => c.status === "ready").length,
    pending: courses.filter((c) => c.status !== "ready").length,
  };
  const featuredId = !query && domain === "all" && subject === "all" ? courses[0]?.id : undefined;

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Titre + recherche */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[36px] font-semibold leading-none tracking-tight text-ink sm:text-[44px]">
            Mon plan d’apprentissage&nbsp;<span className="align-middle">🎓</span>
          </h1>
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) router.push(`/app/search?q=${encodeURIComponent(query.trim())}`);
              }}
              placeholder="Rechercher (Entrée : dans le contenu des cours)"
              aria-label="Rechercher un cours"
              className="h-14 w-full rounded-full bg-surface-2 pl-12 pr-5 text-[15px] text-ink outline-none transition-[background-color,box-shadow] placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-ink/10"
            />
          </label>
        </div>

        {/* Révisions du jour */}
        {dueCards > 0 ? (
          <Link href="/app/review" className="mt-6 flex items-center gap-4 rounded-[24px] bg-lavender px-5 py-4 transition-transform hover:-translate-y-0.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/70 text-ink">
              <Brain className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-ink">
                {dueCards} carte{dueCards > 1 ? "s" : ""} à réviser aujourd’hui
              </span>
              <span className="block text-[13px] text-ink-2/80">Quelques minutes suffisent pour ancrer ce que vous avez appris.</span>
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ) : null}

        {/* Tuiles */}
        <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
          <Tile value={stats.total} label="Total" className="bg-sky" />
          <Tile value={stats.ready} label="Prêts" className="bg-mint" sticker="🎉" />
          <Tile value={stats.pending} label="En analyse" className="border-2 border-dashed border-line-strong" />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[64px_minmax(0,1fr)]">
          {/* Mini barre latérale */}
          <div className="hidden lg:block">
            <div className="sticky top-4 flex flex-col items-center gap-4">
              <div className="flex flex-col gap-1 rounded-full bg-surface p-1.5 shadow-card">
                <RailButton active={view === "grid"} onClick={() => setView("grid")} label="Vue en grille">
                  <LayoutGrid className="h-5 w-5" />
                </RailButton>
                <RailButton active={view === "list"} onClick={() => setView("list")} label="Vue en liste">
                  <List className="h-5 w-5" />
                </RailButton>
              </div>
              <Link href="/app/shared" className="relative flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink shadow-card transition-colors hover:bg-surface-2" title="Partagés avec moi">
                <Bell className="h-5 w-5" />
                {received.length ? <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-primary-ink">{received.length}</span> : null}
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            {/* Filtres */}
            {domains.length > 1 ? (
              <div className="mb-5 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Chip active={domain === "all"} onClick={() => setDomain("all")}>
                    Tous
                  </Chip>
                  {domains.map((d) => (
                    <Chip key={d} active={domain === d} onClick={() => setDomain(d)}>
                      {d}
                    </Chip>
                  ))}
                </div>
                {subjects.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pl-1 text-[12px] font-medium uppercase tracking-wider text-muted">Matière</span>
                    <Chip small active={subject === "all"} onClick={() => setSubject("all")}>
                      Toutes
                    </Chip>
                    {subjects.map((sub) => (
                      <Chip key={sub} small active={subject === sub} onClick={() => setSubject(sub)}>
                        {sub}
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {courses.length === 0 ? (
              <EmptyLibrary />
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Aucun cours ne correspond à votre recherche.</p>
            ) : view === "grid" ? (
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {filtered.map((c) => (
                  <CourseCard key={c.id} course={c} now={nowDate} featured={c.id === featuredId} />
                ))}
              </div>
            ) : (
              <ul className="overflow-hidden rounded-[26px] bg-surface shadow-card">
                {filtered.map((c) => (
                  <CourseRow key={c.id} course={c} now={nowDate} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Colonne droite : contenus reçus */}
      <aside>
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
          Partagés avec&nbsp;moi&nbsp;<span className="align-middle">📬</span>
        </h2>
        <div className="mt-8 space-y-4">
          {received.length === 0 ? (
            <div className="rounded-[26px] border-2 border-dashed border-line-strong p-6 text-center">
              <Inbox className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-3 text-sm text-muted">Les résumés, quiz et lectures que vos camarades vous envoient apparaîtront ici.</p>
            </div>
          ) : (
            <>
              {received.slice(0, 5).map((s, i) => (
                <SharedCard key={s.share_id} share={s} className={cn(i === received.slice(0, 5).length - 1 && received.length > 1 && "xl:rotate-2")} />
              ))}
              {received.length > 5 ? (
                <Link href="/app/shared" className="flex items-center justify-center gap-2 rounded-full bg-surface py-3 text-sm font-medium text-ink shadow-card hover:bg-surface-2">
                  Tout voir <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Tile({ value, label, className, sticker }: { value: number; label: string; className?: string; sticker?: string }) {
  return (
    <div className={cn("relative rounded-[24px] px-4 py-5 text-center", className)}>
      {sticker ? <span className="absolute -right-2 -top-3 text-[26px]">{sticker}</span> : null}
      <p className="text-[36px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-[14px] text-ink-2/80">{label}</p>
    </div>
  );
}

function RailButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors", active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2")}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full font-medium transition-colors",
        small ? "h-8 px-3 text-[12px]" : "h-10 px-4 text-[13px]",
        active ? "bg-ink text-white" : small ? "bg-surface-2 text-ink-2 hover:bg-surface-3" : "bg-surface text-ink-2 shadow-card hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: CourseStatus }) {
  if (status === "ready")
    return <span className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-mint px-4 text-[14px] font-medium text-primary-ink">Prêt 👏</span>;
  if (status === "error")
    return <span className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-danger-soft px-4 text-[14px] font-medium text-danger">Erreur ⚠️</span>;
  return <span className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-surface-2 px-4 text-[14px] font-medium text-ink-2">Analyse ⏱️</span>;
}

function countsLabel(c: LibraryCourse) {
  const parts: string[] = [];
  if (c.counts.summaries) parts.push(`${c.counts.summaries} rés.`);
  if (c.counts.quizzes) parts.push(`${c.counts.quizzes} quiz`);
  if (c.counts.audios) parts.push(`${c.counts.audios} audio`);
  if (c.counts.chats) parts.push(`${c.counts.chats} disc.`);
  return parts.slice(0, 2).join(" · ");
}

export function CourseCard({ course, now, featured }: { course: LibraryCourse; now: Date; featured?: boolean }) {
  const counts = countsLabel(course);
  return (
    <Link
      href={`/app/courses/${course.id}`}
      className={cn(
        "group relative flex min-h-[260px] flex-col rounded-[28px] p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-float",
        featured ? "bg-violet lg:-rotate-1 lg:hover:rotate-0" : "bg-surface",
      )}
    >
      <CornerBubble className={featured ? "bg-surface" : "bg-mint"}>
        <DomainIcon domain={course.domain} />
      </CornerBubble>
      <p className="pr-10 text-[12px] font-medium uppercase tracking-wider text-ink-2/70 line-clamp-1">{course.domain} · {course.subject}</p>
      <h3 className="mt-2 pr-8 text-[26px] font-semibold leading-[1.12] tracking-tight text-ink line-clamp-2">{course.title}</h3>
      <p className={cn("mt-3 text-[15px] leading-relaxed line-clamp-3", featured ? "text-ink/80" : "text-ink-2/80")}>{course.overview ?? "L’analyse du cours est en cours…"}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <StatusPill status={course.status} />
        <div className="flex items-center gap-1.5">
          {counts ? <span className={cn("hidden h-10 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-medium sm:flex", featured ? "bg-white/60 text-ink" : "bg-surface-2 text-ink-2")}>{counts}</span> : null}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
      <span className="sr-only">Modifié {formatRelative(course.updated_at, now)}</span>
    </Link>
  );
}

function CourseRow({ course, now }: { course: LibraryCourse; now: Date }) {
  return (
    <li className="border-b border-line last:border-0">
      <Link href={`/app/courses/${course.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
          <DomainIcon domain={course.domain} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">{course.title}</span>
          <span className="block truncate text-[13px] text-muted">
            {course.subject} · {formatRelative(course.updated_at, now)}
          </span>
        </span>
        <StatusPill status={course.status} />
        <ArrowRight className="h-4 w-4 text-muted" />
      </Link>
    </li>
  );
}

function EmptyLibrary() {
  return (
    <div className="rounded-[28px] border-2 border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink">
        <LayoutGrid className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-[20px] font-semibold text-ink">Déposez votre premier cours</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">PDF, Word, texte ou photo de vos notes : nous en tirons les grandes lignes, l’essentiel à retenir, des résumés, une lecture audio et des quiz.</p>
      <Link href="/app/courses/new" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-white hover:bg-black">
        Nouveau cours <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
