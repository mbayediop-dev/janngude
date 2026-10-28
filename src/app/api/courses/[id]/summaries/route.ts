import { handleApiError, jsonError, ndjsonResponse, readJsonBody, requireApiUser } from "@/lib/api";
import { streamSummary } from "@/lib/ai/summarize";
import { describeAiError, assertNotRefused, messageText } from "@/lib/ai/client";
import { logUsage } from "@/lib/usage";
import type { SummaryLength } from "@/lib/supabase/types";

export const maxDuration = 300;

const LABEL: Record<SummaryLength, string> = { short: "court", medium: "standard", long: "détaillé" };

export async function POST(req: Request, ctx: RouteContext<"/api/courses/[id]/summaries">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ length?: SummaryLength; focus?: string }>(req);
    const length: SummaryLength = (["short", "medium", "long"] as const).includes(body.length ?? "medium") ? (body.length ?? "medium") : "medium";

    const { data: course } = await supabase.from("courses").select("id,title,domain,subject,content_text,status").eq("id", id).maybeSingle();
    if (!course || !course.content_text) return jsonError("Cours introuvable ou non analysé.", 404);

    return ndjsonResponse(async (emit) => {
      try {
        const stream = streamSummary({ text: course.content_text!, title: course.title, domain: course.domain, subject: course.subject, length, focus: body.focus?.slice(0, 200) });
        stream.on("text", (delta) => emit({ type: "delta", text: delta }));
        const message = await stream.finalMessage();
        assertNotRefused(message);
        const content = messageText(message).trim();

        const { data: row, error } = await supabase
          .from("summaries")
          .insert({ course_id: course.id, user_id: user.id, length, title: `Résumé ${LABEL[length]}`, content })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        await logUsage(supabase, user.id, "ai_summary_chars", course.content_text!.length, { course_id: id, length });
        emit({ type: "done", summary: row });
      } catch (error) {
        emit({ type: "error", message: describeAiError(error) });
      }
    });
  } catch (e) {
    return handleApiError(e);
  }
}
