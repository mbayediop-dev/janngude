import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { Skeleton, PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ReviewSession, type ReviewCard } from "@/components/flashcards/review-session";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Révisions du jour" };

export default function ReviewPage({ searchParams }: PageProps<"/app/review">) {
  return (
    <>
      <PageHeader title="Révisions du jour" emoji="🧠" description="Vos cartes mémoire arrivées à échéance, tous cours confondus. Quelques minutes par jour suffisent." />
      <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-2xl rounded-[28px]" />}>
        <Session searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Session({ searchParams }: { searchParams: PageProps<"/app/review">["searchParams"] }) {
  const sp = await searchParams;
  const courseId = typeof sp.course === "string" ? sp.course : null;
  const all = sp.all === "1";
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase.from("flashcards").select("*").eq("user_id", user.id).order("due_at", { ascending: true }).limit(60);
  if (courseId) query = query.eq("course_id", courseId);
  if (!all) query = query.lte("due_at", new Date().toISOString());
  const { data: cards } = await query;

  const ids = Array.from(new Set((cards ?? []).map((c) => c.course_id)));
  const { data: courses } = ids.length ? await supabase.from("courses").select("id,title").in("id", ids) : { data: [] as { id: string; title: string }[] };
  const titles = new Map((courses ?? []).map((c) => [c.id, c.title]));
  const list: ReviewCard[] = (cards ?? []).map((c) => ({ ...c, course_title: titles.get(c.course_id) }));

  if (!list.length) {
    return (
      <EmptyState
        mascot={{ pose: "zen" }}
        title="Rien à réviser pour le moment"
        description="Toutes vos cartes sont à jour. Créez des cartes depuis l’onglet « Cartes » d’un cours, ou revenez demain."
        action={
          <Button asChild variant="outline">
            <Link href={courseId ? `/app/courses/${courseId}?tab=flashcards` : "/app"}>Retour</Link>
          </Button>
        }
      />
    );
  }

  return <ReviewSession cards={list} title={courseId ? (titles.get(courseId) ?? "Révision") : "Tous les cours"} backHref={courseId ? `/app/courses/${courseId}?tab=flashcards` : "/app"} />;
}
