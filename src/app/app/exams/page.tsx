import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TimerReset, ChevronRight } from "lucide-react";
import { Skeleton, PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ExamForm } from "@/components/exams/exam-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDuration } from "@/lib/utils";

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <ExamForm courses={courses ?? []} />
      <div>
        {!exams?.length ? (
          <EmptyState icon={<TimerReset />} title="Aucun examen blanc" description="Créez votre premier examen à partir d’un ou plusieurs cours." />
        ) : (
          <ul className="space-y-3">
            {exams.map((exam) => {
              const mine = (attempts ?? []).filter((a) => a.exam_id === exam.id);
              const best = mine.reduce((m, a) => Math.max(m, a.total ? a.score / a.total : 0), 0);
              return (
                <li key={exam.id}>
                  <Link href={`/app/exams/${exam.id}`} className="flex items-center gap-4 rounded-[22px] bg-surface p-5 shadow-card transition-colors hover:bg-surface-2/40">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lemon text-ink">
                      <TimerReset className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{exam.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                        <Badge tone="neutral">{exam.questions.length} questions</Badge>
                        <Badge tone="neutral">{exam.duration_minutes} min</Badge>
                        <span>
                          · {exam.course_ids.length} cours · {formatDate(exam.created_at)}
                        </span>
                        {mine.length ? (
                          <span>
                            · meilleur score {Math.round(best * 100)} % · dernier passage en {formatDuration(mine[0].time_spent_seconds)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
