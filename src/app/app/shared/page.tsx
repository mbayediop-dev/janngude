import { Suspense } from "react";
import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { Skeleton, PageHeader, EmptyState } from "@/components/ui/misc";
import { SharedCard } from "@/components/share/shared-card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReceivedShare } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Partagés avec moi" };

export default function SharedPage() {
  return (
    <>
      <PageHeader title="Partagés avec moi" emoji="📬" description="Les résumés, quiz, lectures et discussions que d’autres étudiants vous ont transmis." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-[28px]" />}>
        <SharedList />
      </Suspense>
    </>
  );
}

async function SharedList() {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_received_shares");
  const shares = (data ?? []) as ReceivedShare[];

  if (shares.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Rien pour l’instant"
        description="Quand un étudiant vous partage un contenu, ouvrez son lien connecté à votre compte ou demandez-lui de l’ajouter à votre espace via votre e-mail."
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {shares.map((s) => (
        <SharedCard key={s.share_id} share={s} />
      ))}
    </div>
  );
}
