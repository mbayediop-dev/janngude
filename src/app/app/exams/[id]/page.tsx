import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/misc";
import { ExamRunner } from "@/components/exams/exam-runner";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Examen blanc" };

export default function ExamPage({ params }: PageProps<"/app/exams/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-xl rounded-[28px]" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/app/exams/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: exam } = await supabase.from("exams").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!exam) notFound();
  return <ExamRunner exam={exam} />;
}
