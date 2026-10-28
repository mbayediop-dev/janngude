import { connection } from "next/server";
import { handleApiError, requireApiUser, ApiError } from "@/lib/api";

export async function GET(_req: Request, ctx: RouteContext<"/api/chats/[id]">) {
  await connection();
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { data, error } = await supabase.from("chat_messages").select("id,role,content,created_at").eq("chat_id", id).order("created_at", { ascending: true });
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ messages: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/chats/[id]">) {
  try {
    const { id } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (error) throw new ApiError(error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
