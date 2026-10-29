import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/misc";
import { ProcessingView } from "@/components/courses/processing-view";
import { CourseWorkspace, type WorkspaceTab } from "@/components/courses/course-workspace";
import type { QuizWithAttempts } from "@/components/courses/quiz-panel";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ttsConfigured, ttsMaxChars } from "@/lib/tts";

export const metadata: Metadata = { title: "Cours" };

export default function CoursePage({ params, searchParams }: PageProps<"/app/courses/[id]">) {
  return (
    <Suspense fallback={<CourseSkeleton />}>
      <CourseContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CourseContent({ params, searchParams }: { params: PageProps<"/app/courses/[id]">["params"]; searchParams: PageProps<"/app/courses/[id]">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/courses/${id}`);
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!course) notFound();

  if (course.status !== "ready") {
    return <ProcessingView courseId={course.id} title={course.title} status={course.status} errorMessage={course.error_message} autoTitle={sp.auto_title === "1"} />;
  }

  const [{ data: summaries }, { data: quizzes }, { data: attempts }, { data: audios }, { data: chats }, { data: voices }, { data: flashcards }] = await Promise.all([
    supabase.from("summaries").select("*").eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("quizzes").select("*").eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("quiz_attempts").select("quiz_id,score,total,created_at,via_share").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("audio_readings").select("*").eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("chats").select("*").eq("course_id", id).order("updated_at", { ascending: false }),
    supabase.from("voices").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("flashcards").select("*").eq("course_id", id).order("created_at", { ascending: false }),
  ]);

  const quizList: QuizWithAttempts[] = (quizzes ?? []).map((q) => ({
    ...q,
    attempts: (attempts ?? []).filter((a) => a.quiz_id === q.id).map((a) => ({ score: a.score, total: a.total, created_at: a.created_at })),
  }));

  const tabParam = typeof sp.tab === "string" ? sp.tab : "overview";
  const initialTab = (["overview", "summaries", "audio", "quiz", "chat", "flashcards"].includes(tabParam) ? tabParam : "overview") as WorkspaceTab;
  const initialChatId = typeof sp.chat === "string" && (chats ?? []).some((c) => c.id === sp.chat) ? sp.chat : null;

  return (
    <CourseWorkspace
      course={{
        id: course.id,
        title: course.title,
        domain: course.domain,
        subject: course.subject,
        overview: course.overview,
        outline: course.outline,
        key_points: course.key_points,
        keywords: course.keywords,
        word_count: course.word_count,
        file_name: course.file_name,
        file_size: course.file_size,
        created_at: course.created_at,
        content_text: course.content_text,
      }}
      summaries={summaries ?? []}
      quizzes={quizList}
      audios={audios ?? []}
      chats={chats ?? []}
      flashcards={flashcards ?? []}
      now={new Date().toISOString()}
      voices={voices ?? []}
      tts={ttsConfigured()}
      ttsMaxChars={ttsMaxChars()}
      initialTab={initialTab}
      initialChatId={initialChatId}
    />
  );
}

function CourseSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-80" />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
