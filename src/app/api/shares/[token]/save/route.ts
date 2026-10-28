import { handleApiError, requireApiUser, ApiError } from "@/lib/api";

export async function POST(_req: Request, ctx: RouteContext<"/api/shares/[token]/save">) {
  try {
    const { token } = await ctx.params;
    const { supabase } = await requireApiUser();
    const { error } = await supabase.rpc("save_share", { p_token: token });
    if (error) throw new ApiError(error.message.includes("not_found") ? "Ce partage n’existe plus." : error.message, 404);
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
