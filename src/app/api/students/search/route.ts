import { connection } from "next/server";
import { handleApiError, requireApiUser, ApiError } from "@/lib/api";

/** Autocomplétion d’un étudiant par nom, téléphone ou e-mail (deux caractères minimum). */
export async function GET(req: Request) {
  await connection();
  try {
    const { supabase } = await requireApiUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return Response.json({ students: [] });
    const { data, error } = await supabase.rpc("search_students", { p_query: q, p_limit: 8 });
    if (error) throw new ApiError(/search_students/.test(error.message) ? "Recherche indisponible : appliquez la migration 0005." : error.message, 500);
    return Response.json({ students: data ?? [] });
  } catch (e) {
    return handleApiError(e);
  }
}
