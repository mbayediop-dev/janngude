import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/misc";
import { GroupView } from "@/components/groups/group-view";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GroupLeaderboardRow, GroupMemberInfo, GroupShareInfo } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Groupe" };

export default function GroupPage({ params }: PageProps<"/app/groups/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-[28px]" />}>
      <GroupContent params={params} />
    </Suspense>
  );
}

async function GroupContent({ params }: { params: PageProps<"/app/groups/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/app/groups/${id}`);
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!group) notFound();

  const [{ data: members }, { data: shares }, { data: leaderboard }] = await Promise.all([
    supabase.rpc("group_members_list", { p_group: id }),
    supabase.rpc("group_shares_list", { p_group: id }),
    supabase.rpc("group_leaderboard", { p_group: id }),
  ]);

  return (
    <GroupView
      group={group}
      viewerId={user.id}
      members={(members ?? []) as GroupMemberInfo[]}
      shares={(shares ?? []) as GroupShareInfo[]}
      leaderboard={(leaderboard ?? []) as GroupLeaderboardRow[]}
    />
  );
}
