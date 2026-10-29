import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TimerReset, ArrowRight, Shuffle, Timer, BarChart3 } from "lucide-react";
import { Skeleton, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExamForm } from "@/components/exams/exam-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Examens blancs" };

export default function ExamsPage() {
  return (
    <>
      <PageHeader title="Examens blancs" emoji="⏱️" description="Entraînez-vous dans les conditions de l’épreuve : plusieurs cours, un chronomètre, un bilan par cours." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[28px]" />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: courses }, { data: exams }, { data: attempts }] = await Promise.all([
    supabase.from("courses").select("id,title,domain,subject").eq("user_id", user.id).eq("status", "ready").order("updated_at", { ascending: false }),
    supabase.from("exams").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("exam_attempts").select("exam_id,score,total,time_spent_seconds,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const list = exams ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <ExamForm courses={courses ?? []} />
      <div className="min-w-0">
        <h2 className="mb-4 flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink">
          Mes examens
          {list.length ? <span className="rounded-full bg-surface px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 shadow-card">{list.length}</span> : null}
        </h2>
        {list.length === 0 ? (
          <div className="rounded-[28px] bg-surface p-7 shadow-card">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lemon text-ink">
              <TimerReset className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-ink">
              Votre premier examen blanc apparaîtra ici&nbsp;<span className="align-middle">🎯</span>
            </h3>
            <p className="mt-1.5 text-sm text-muted">Choisissez un ou plusieurs cours à gauche, le nombre de questions et la durée, puis « Créer l’examen ».</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Shuffle, bg: "bg-sky", title: "Plusieurs cours mélangés", text: "Les questions de chaque cours sont tirées et alternées, comme un vrai partiel." },
                { icon: Timer, bg: "bg-pink", title: "Chronomètre", text: "À la fin du temps, les réponses sont envoyées automatiquement." },
                { icon: BarChart3, bg: "bg-mint", title: "Bilan par cours", text: "Score global, corrections et points faibles cours par cours." },
              ].map((f) => (
                <li key={f.title} className="rounded-[20px] bg-surface-2 p-4">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-ink", f.bg)}>
                    <f.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-[14px] font-semibold text-ink">{f.title}</p>
                  <p className="mt-1 text-[12px] leading-snug text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((exam) => {
              const mine = (attempts ?? []).filter((a) => a.exam_id === exam.id);
              const best = mine.reduce((m, a) => Math.max(m, a.total ? a.score / a.total : 0), 0);
              const pct = Math.round(best * 100);
              const last = mine[0];
              return (
                <li key={exam.id} className="rounded-[24px] bg-surface p-4 shadow-card sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-lemon text-ink">
                      <TimerReset className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[17px] font-semibold tracking-tight text-ink">{exam.title}</h3>
                      <p className="mt-1 text-[13px] text-muted">
                        {exam.questions.length} questions · {exam.duration_minutes} min · {exam.course_ids.length} cours · créé le {formatDate(exam.created_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {mine.length ? (
                          <>
                            <Badge tone={pct >= 70 ? "mint" : pct >= 50 ? "lemon" : "pink"}>Meilleur score {pct} %</Badge>
                            <span className="text-[12px] text-muted">
                              {mine.length} passage{mine.length > 1 ? "s" : ""} · dernier : {last.score}/{last.total} en {formatDuration(last.time_spent_seconds)}
                            </span>
                          </>
                        ) : (
                          <Badge tone="neutral">Jamais passé</Badge>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex">
                      <Link href={`/app/exams/${exam.id}`}>
                        {mine.length ? "Repasser" : "Commencer"} <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <Button asChild size="sm" className="mt-3 w-full sm:hidden">
                    <Link href={`/app/exams/${exam.id}`}>
                      {mine.length ? "Repasser l’examen" : "Commencer l’examen"} <ArrowRight className="h-4 w-4" />
                    </Link>
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
