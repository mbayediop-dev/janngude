import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { GroupsHome } from "@/components/groups/groups-home";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GroupSummary } from "@/lib/groups";

export const metadata: Metadata = { title: "Groupes de classe" };

export default function GroupsPage({ searchParams }: PageProps<"/app/groups">) {
  return (
    <>
      <PageHeader title="Groupes de classe" emoji="👥" description="Créez un groupe pour votre promo, partagez-y vos résumés, quiz et lectures, et comparez vos scores entre camarades." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-[28px]" />}>
        <GroupsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function GroupsList({ searchParams }: { searchParams: PageProps<"/app/groups">["searchParams"] }) {
  const sp = await searchParams;
  const user = await requireUser("/app/groups");
  const supabase = await createClient();
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("groups").select("*").order("created_at", { ascending: false }),
    supabase.from("group_members").select("group_id,user_id"),
  ]);
  const list: GroupSummary[] = (groups ?? []).map((g) => ({
    ...g,
    role: g.owner_id === user.id ? "owner" : "member",
    members: (members ?? []).filter((m) => m.group_id === g.id).length,
  }));
  const code = typeof sp.code === "string" ? sp.code.toUpperCase() : "";
  return <GroupsHome groups={list} initialCode={code} />;
}
