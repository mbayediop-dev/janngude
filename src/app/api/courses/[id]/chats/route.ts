import { handleApiError, jsonError, ndjsonResponse, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { streamChat } from "@/lib/ai/chat";
import { describeAiError, assertNotRefused, messageText } from "@/lib/ai/client";
import { truncate } from "@/lib/utils";
import { logUsage } from "@/lib/usage";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/courses/[id]/chats">) {
  try {
    const { id } = await ctx.params;
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ chatId?: string; message?: string }>(req);
    const message = (body.message ?? "").trim().slice(0, 4000);
    if (!message) throw new ApiError("Message vide.");

    const { data: course } = await supabase.from("courses").select("id,title,domain,subject,content_text").eq("id", id).maybeSingle();
    if (!course || !course.content_text) return jsonError("Cours introuvable ou non analysé.", 404);

    // Discussion existante ou nouvelle
    let chat;
    if (body.chatId) {
      const { data } = await supabase.from("chats").select("*").eq("id", body.chatId).eq("course_id", id).maybeSingle();
      if (!data) return jsonError("Discussion introuvable.", 404);
      chat = data;
    } else {
      const { data, error } = await supabase
        .from("chats")
        .insert({ course_id: id, user_id: user.id, title: truncate(message.replace(/\s+/g, " "), 60) })
        .select("*")
        .single();
      if (error) throw new ApiError(error.message, 500);
      chat = data;
    }

    const { data: history } = await supabase.from("chat_messages").select("role,content").eq("chat_id", chat.id).order("created_at", { ascending: true });
    const recent = (history ?? []).slice(-30);

    const { data: userMessage, error: umError } = await supabase.from("chat_messages").insert({ chat_id: chat.id, user_id: user.id, role: "user", content: message }).select("*").single();
    if (umError) throw new ApiError(umError.message, 500);

    return ndjsonResponse(async (emit) => {
      try {
        const stream = streamChat({
          course: { title: course.title, domain: course.domain, subject: course.subject, text: course.content_text! },
          history: recent,
          message,
        });
        stream.on("text", (delta) => emit({ type: "delta", text: delta }));
        const final = await stream.finalMessage();
        assertNotRefused(final);
        const content = messageText(final).trim();

        const { data: assistantMessage, error } = await supabase.from("chat_messages").insert({ chat_id: chat.id, user_id: user.id, role: "assistant", content }).select("*").single();
        if (error) throw new Error(error.message);
        const { data: updatedChat } = await supabase.from("chats").update({ title: chat.title }).eq("id", chat.id).select("*").single();
        await logUsage(supabase, user.id, "ai_chat_chars", message.length + content.length, { course_id: id, chat_id: chat.id });

        emit({ type: "done", chat: updatedChat ?? chat, userMessage, assistantMessage });
      } catch (error) {
        emit({ type: "error", message: describeAiError(error) });
      }
    });
  } catch (e) {
    return handleApiError(e);
  }
}
