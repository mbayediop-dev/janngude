import { handleApiError, readJsonBody, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: RouteContext<"/api/shares/[token]/grade">) {
  try {
    const { token } = await ctx.params;
    const body = await readJsonBody<{ answers?: (number | null)[]; guestName?: string }>(req);
    const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : null)) : [];
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("grade_shared_quiz", { p_token: token, p_answers: answers, p_guest_name: body.guestName?.slice(0, 60) ?? null });
    if (error) throw new ApiError(error.message.includes("not_found") ? "Ce quiz n’est plus disponible." : error.message, 404);
    return Response.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
