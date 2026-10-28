import type { GroupRow } from "@/lib/supabase/types";
import { appUrl } from "@/lib/utils";

export type GroupSummary = GroupRow & { role: "owner" | "member"; members: number };

export function groupJoinUrl(code: string) {
  return appUrl(`/app/groups?code=${encodeURIComponent(code)}`);
}

export function groupInviteMessage(name: string, code: string) {
  return `Rejoins mon groupe de classe « ${name} » sur Janngude pour réviser ensemble.\nCode : ${code}\n${groupJoinUrl(code)}`;
}
