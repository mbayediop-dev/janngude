import { connection } from "next/server";
import { handleApiError, requireApiUser, ApiError } from "@/lib/api";

export type LibraryItem = { id: string; title: string };
export type LibraryCourseEntry = { id: string; title: string; domain: string; subject: string; summaries: LibraryItem[]; audios: LibraryItem[]; quizzes: LibraryItem[]; chats: LibraryItem[] };

/** Contenus partageables de l’utilisateur, regroupés par cours (pour le partage à un groupe). */
export async function GET() {
  await connection();
  try {
    const { supabase, user } = await requireApiUser();
    const [{ data: courses, error }, { data: summaries }, { data: audios }, { data: quizzes }, { data: chats }] = await Promise.all([
      supabase.from("courses").select("id,title,domain,subject").eq("user_id", user.id).eq("status", "ready").order("updated_at", { ascending: false }),
      supabase.from("summaries").select("id,title,course_id").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("audio_readings").select("id,title,course_id").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("quizzes").select("id,title,course_id").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("chats").select("id,title,course_id").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);
    if (error) throw new ApiError(error.message, 500);
    const pick = (rows: { id: string; title: string; course_id: string }[] | null, courseId: string): LibraryItem[] => (rows ?? []).filter((r) => r.course_id === courseId).map((r) => ({ id: r.id, title: r.title }));
    const list: LibraryCourseEntry[] = (courses ?? []).map((c) => ({
      ...c,
      summaries: pick(summaries, c.id),
      audios: pick(audios, c.id),
      quizzes: pick(quizzes, c.id),
      chats: pick(chats, c.id),
    }));
    return Response.json({ courses: list });
  } catch (e) {
    return handleApiError(e);
  }
}
