import { handleApiError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";

export async function PATCH(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ full_name?: string; phone?: string }>(req);
    const fullName = (body.full_name ?? "").trim().slice(0, 80);
    if (!fullName) throw new ApiError("Le nom ne peut pas être vide.");
    const rawPhone = (body.phone ?? "").trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) throw new ApiError("Numéro de téléphone invalide.");
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: fullName, phone });
    if (error) throw new ApiError(/phone/.test(error.message) ? "Le téléphone n’est pas encore activé : appliquez la migration 0005." : error.message, 500);
    await supabase.auth.updateUser({ data: { full_name: fullName, phone: phone ?? "" } });
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
