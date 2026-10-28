import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { UploadForm } from "@/components/courses/upload-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nouveau cours" };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="Déposer un cours" emoji="📚" description="Choisissez le fichier, la formation et la matière. L’analyse démarre tout de suite après." />
      <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-[28px]" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("domain,subject").eq("user_id", user.id);
  const knownDomains = Array.from(new Set((data ?? []).map((c) => c.domain)));
  const knownSubjects: Record<string, string[]> = {};
  for (const c of data ?? []) {
    knownSubjects[c.domain] ??= [];
    if (!knownSubjects[c.domain].includes(c.subject)) knownSubjects[c.domain].push(c.subject);
  }
  return <UploadForm knownDomains={knownDomains} knownSubjects={knownSubjects} />;
}
