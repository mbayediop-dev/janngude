import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { nextReview } from "@/lib/srs";

export async function POST(req: Request, ctx: RouteContext<"/api/flashcards/[id]/review">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ grade?: number }>(req);
    const grade = [0, 1, 2, 3].includes(Number(body.grade)) ? (Number(body.grade) as 0 | 1 | 2 | 3) : null;
    if (grade === null) throw new ApiError("Note invalide.");

    const { data: card } = await supabase.from("flashcards").select("*").eq("id", id).maybeSingle();
    if (!card) return jsonError("Carte introuvable.", 404);

    const next = nextReview(card, grade);
    const { data: updated, error } = await supabase
      .from("flashcards")
      .update({ ...next, last_reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new ApiError(error.message, 500);
    await supabase.from("flashcard_reviews").insert({ flashcard_id: id, user_id: user.id, grade });
    return Response.json({ card: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
