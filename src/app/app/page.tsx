import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/misc";
import { CourseLibrary, type LibraryCourse } from "@/components/dashboard/course-library";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReceivedShare } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Mon plan d’apprentissage" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: courses, error: coursesError }, { data: summaries }, { data: quizzes }, { data: audios }, { data: chats }, { data: received }, { count: dueCards }] = await Promise.all([
    supabase.from("courses").select("id,title,domain,subject,status,overview,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("summaries").select("course_id").eq("user_id", user.id),
    supabase.from("quizzes").select("course_id").eq("user_id", user.id),
    supabase.from("audio_readings").select("course_id").eq("user_id", user.id),
    supabase.from("chats").select("course_id").eq("user_id", user.id),
    supabase.rpc("list_received_shares"),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user.id).lte("due_at", new Date().toISOString()),
  ]);

  if (coursesError?.code === "PGRST205") return <SetupNotice />;

  const count = (rows: { course_id: string }[] | null, id: string) => rows?.filter((r) => r.course_id === id).length ?? 0;

  const list: LibraryCourse[] = (courses ?? []).map((c) => ({
    ...c,
    counts: { summaries: count(summaries, c.id), quizzes: count(quizzes, c.id), audios: count(audios, c.id), chats: count(chats, c.id) },
  }));

  return <CourseLibrary courses={list} received={(received ?? []) as ReceivedShare[]} now={new Date().toISOString()} dueCards={dueCards ?? 0} firstName={user.name?.trim().split(/\s+/)[0] ?? null} />;
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-12 w-2/3 max-w-md" />
          <Skeleton className="h-14 w-80 rounded-full" />
        </div>
        <div className="grid max-w-xl grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-[24px]" />
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px] rounded-[28px]" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-[26px]" />
        ))}
      </div>
    </div>
  );
}
