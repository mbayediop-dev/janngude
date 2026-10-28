import { connection } from "next/server";
import { handleApiError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import type { GroupSummary } from "@/lib/groups";

/** Groupes de l’utilisateur (propriétaire ou membre) avec le nombre de membres. */
export async function GET() {
  await connection();
  try {
    const { supabase, user } = await requireApiUser();
    const [{ data: groups, error }, { data: members }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id,user_id"),
    ]);
    if (error) throw new ApiError(error.message, 500);
    const list: GroupSummary[] = (groups ?? []).map((g) => ({
      ...g,
      role: g.owner_id === user.id ? "owner" : "member",
      members: (members ?? []).filter((m) => m.group_id === g.id).length,
    }));
    return Response.json({ groups: list });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Crée un groupe (`name`) ou rejoint un groupe par son code (`code`). */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ name?: string; code?: string }>(req);

    if (body.code) {
      const code = body.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 4) throw new ApiError("Code de groupe invalide.");
      const { data: id, error } = await supabase.rpc("join_group", { p_code: code });
      if (error) {
        if (/group_not_found/.test(error.message)) throw new ApiError("Aucun groupe ne correspond à ce code.", 404);
        throw new ApiError(error.message, 500);
      }
      return Response.json({ id, joined: true });
    }

    const name = (body.name ?? "").trim().slice(0, 80);
    if (name.length < 2) throw new ApiError("Donnez un nom au groupe (2 caractères minimum).");
    const { count } = await supabase.from("groups").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
    if ((count ?? 0) >= 20) throw new ApiError("Vous avez atteint la limite de 20 groupes créés.");

    const { data: group, error } = await supabase.from("groups").insert({ owner_id: user.id, name }).select("*").single();
    if (error) throw new ApiError(error.message, 500);
    const { error: memberError } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id, role: "owner" });
    if (memberError) throw new ApiError(memberError.message, 500);
    return Response.json({ id: group.id, code: group.code, joined: false });
  } catch (e) {
    return handleApiError(e);
  }
}
