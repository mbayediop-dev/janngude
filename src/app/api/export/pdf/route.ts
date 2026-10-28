import { connection } from "next/server";
import { handleApiError, jsonError, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { renderSummaryPdf, renderQuizPdf, renderChatPdf, renderCoursePdf } from "@/lib/pdf/documents";
import { slugify } from "@/lib/utils";
import type { SharePayload, QuizQuestion } from "@/lib/supabase/types";

export const maxDuration = 60;

async function courseMeta(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string) {
  const { data } = await supabase.from("courses").select("title,domain,subject").eq("id", courseId).maybeSingle();
  if (!data) throw new ApiError("Cours introuvable.", 404);
  return data;
}

function pdfResponse(buffer: Buffer, name: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slugify(name) || "document"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");
    const withAnswers = url.searchParams.get("answers") === "1";
    const supabase = await createClient();
    const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());

    // --- Partage public (sans compte) ---
    if (token) {
      const { data } = await supabase.rpc("get_share", { p_token: token });
      if (!data) return jsonError("Partage introuvable.", 404);
      const payload = data as unknown as SharePayload;
      const author = payload.share.owner_name;
      const r = payload.resource;
      if (payload.share.type === "summary" && "content" in r) {
        return pdfResponse(await renderSummaryPdf({ title: r.title, course: r.course.title, domain: r.course.domain, subject: r.course.subject, content: r.content, author, date }), payload.share.title);
      }
      if (payload.share.type === "quiz" && "questions" in r) {
        const questions: QuizQuestion[] = r.questions.map((q) => ({ ...q, answer_index: -1, explanation: "" }));
        return pdfResponse(await renderQuizPdf({ title: r.title, course: r.course.title, domain: r.course.domain, subject: r.course.subject, questions, withAnswers: false, author, date }), payload.share.title);
      }
      if (payload.share.type === "chat" && "messages" in r) {
        return pdfResponse(await renderChatPdf({ title: r.title, course: r.course.title, domain: r.course.domain, subject: r.course.subject, messages: r.messages, author, date }), payload.share.title);
      }
      if (payload.share.type === "course" && "outline" in r) {
        return pdfResponse(await renderCoursePdf({ title: r.title, domain: r.course.domain, subject: r.course.subject, overview: r.overview, outline: r.outline, keyPoints: r.key_points, keywords: r.keywords, author, date }), payload.share.title);
      }
      return jsonError("Ce type de contenu ne s’exporte pas en PDF.", 400);
    }

    // --- Propriétaire connecté ---
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError("Connexion requise.", 401);
    if (!type || !id) throw new ApiError("Paramètres manquants.");

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const author = profile?.full_name || user.email || "Étudiant";

    if (type === "summary") {
      const { data: s } = await supabase.from("summaries").select("*").eq("id", id).maybeSingle();
      if (!s) return jsonError("Résumé introuvable.", 404);
      const c = await courseMeta(supabase, s.course_id);
      return pdfResponse(await renderSummaryPdf({ title: `${c.title} — ${s.title.toLowerCase()}`, course: c.title, domain: c.domain, subject: c.subject, content: s.content, author, date }), `${c.title}-resume`);
    }
    if (type === "quiz") {
      const { data: q } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
      if (!q) return jsonError("Quiz introuvable.", 404);
      const c = await courseMeta(supabase, q.course_id);
      return pdfResponse(await renderQuizPdf({ title: q.title, course: c.title, domain: c.domain, subject: c.subject, questions: q.questions, withAnswers, author, date }), `${q.title}${withAnswers ? "-corrige" : ""}`);
    }
    if (type === "course") {
      const { data: c } = await supabase.from("courses").select("title,domain,subject,overview,outline,key_points,keywords").eq("id", id).maybeSingle();
      if (!c) return jsonError("Cours introuvable.", 404);
      return pdfResponse(await renderCoursePdf({ title: c.title, domain: c.domain, subject: c.subject, overview: c.overview, outline: c.outline ?? [], keyPoints: c.key_points ?? [], keywords: c.keywords ?? [], author, date }), `${c.title}-fiche`);
    }
    if (type === "chat") {
      const { data: ch } = await supabase.from("chats").select("*").eq("id", id).maybeSingle();
      if (!ch) return jsonError("Discussion introuvable.", 404);
      const c = await courseMeta(supabase, ch.course_id);
      const { data: messages } = await supabase.from("chat_messages").select("role,content").eq("chat_id", id).order("created_at", { ascending: true });
      return pdfResponse(await renderChatPdf({ title: ch.title, course: c.title, domain: c.domain, subject: c.subject, messages: messages ?? [], author, date }), `${c.title}-discussion`);
    }
    throw new ApiError("Type inconnu.");
  } catch (e) {
    return handleApiError(e);
  }
}
