import { handleApiError, jsonError, readJsonBody, requireApiUser, ApiError } from "@/lib/api";
import { shareUrl, SHARE_TYPE_LABEL } from "@/lib/share";
import { emailConfigured, renderEmail, sendEmail } from "@/lib/email";
import type { ShareResourceType } from "@/lib/supabase/types";

const TYPES: ShareResourceType[] = ["summary", "quiz", "audio", "chat", "course"];

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const body = await readJsonBody<{ type?: ShareResourceType; id?: string; recipientEmail?: string; groupId?: string }>(req);
    if (!body.type || !TYPES.includes(body.type) || !body.id) throw new ApiError("Paramètres invalides.");

    // Vérifie que la ressource appartient à l’utilisateur et récupère un titre.
    let title: string | null = null;
    if (body.type === "summary") {
      const { data } = await supabase.from("summaries").select("title,course_id").eq("id", body.id).maybeSingle();
      if (data) {
        const { data: c } = await supabase.from("courses").select("title").eq("id", data.course_id).maybeSingle();
        title = c ? `${c.title} — ${data.title.toLowerCase()}` : data.title;
      }
    } else if (body.type === "quiz") {
      const { data } = await supabase.from("quizzes").select("title").eq("id", body.id).maybeSingle();
      title = data?.title ?? null;
    } else if (body.type === "audio") {
      const { data } = await supabase.from("audio_readings").select("title").eq("id", body.id).maybeSingle();
      title = data?.title ?? null;
    } else if (body.type === "chat") {
      const { data } = await supabase.from("chats").select("title,course_id").eq("id", body.id).maybeSingle();
      if (data) {
        const { data: c } = await supabase.from("courses").select("title").eq("id", data.course_id).maybeSingle();
        title = c ? `${c.title} — ${data.title}` : data.title;
      }
    } else {
      const { data } = await supabase.from("courses").select("title,status").eq("id", body.id).eq("user_id", user.id).maybeSingle();
      if (data && data.status !== "ready") throw new ApiError("Ce cours n’est pas encore analysé.");
      title = data?.title ?? null;
    }
    if (!title) return jsonError("Contenu introuvable.", 404);

    // Partage à un groupe de classe : visible par tous ses membres sur la page du groupe.
    if (body.groupId) {
      const { data: group } = await supabase.from("groups").select("id,name").eq("id", body.groupId).maybeSingle();
      if (!group) return jsonError("Groupe introuvable ou vous n’en êtes pas membre.", 404);
      const { data: existing } = await supabase.from("shares").select("token").eq("resource_type", body.type).eq("resource_id", body.id).eq("group_id", group.id).maybeSingle();
      if (existing) return Response.json({ token: existing.token, url: shareUrl(existing.token), group: group.name });
      const { data: share, error } = await supabase
        .from("shares")
        .insert({ user_id: user.id, resource_type: body.type, resource_id: body.id, title: title.slice(0, 160), group_id: group.id })
        .select("token")
        .single();
      if (error) throw new ApiError(error.message, 500);
      return Response.json({ token: share.token, url: shareUrl(share.token), group: group.name });
    }

    const recipient = body.recipientEmail?.trim().toLowerCase() || null;
    if (recipient && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) throw new ApiError("Adresse e-mail invalide.");

    // Réutilise le lien public existant (sans destinataire ni groupe).
    if (!recipient) {
      const { data: existing } = await supabase.from("shares").select("token").eq("resource_type", body.type).eq("resource_id", body.id).is("recipient_email", null).is("group_id", null).maybeSingle();
      if (existing) return Response.json({ token: existing.token, url: shareUrl(existing.token) });
    }

    const { data: share, error } = await supabase
      .from("shares")
      .insert({ user_id: user.id, resource_type: body.type, resource_id: body.id, title: title.slice(0, 160), recipient_email: recipient })
      .select("token")
      .single();
    if (error) throw new ApiError(error.message, 500);
    const url = shareUrl(share.token);

    // Destinataire nommé : il retrouve le contenu dans « Partagés avec moi » et reçoit un e-mail avec le lien.
    let emailSent = false;
    let emailError: string | null = null;
    if (recipient && emailConfigured()) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const sender = profile?.full_name || user.email || "Un étudiant";
      const kind = SHARE_TYPE_LABEL[body.type].toLowerCase();
      try {
        await sendEmail({
          to: recipient,
          subject: `${sender} vous partage un ${kind} sur Janngude`,
          replyTo: user.email ?? undefined,
          html: renderEmail({
            title: `${sender} vous partage un ${kind} 📬`,
            intro: `« ${title} » vous attend sur Janngude. Ouvrez-le directement, avec ou sans compte ; connecté, vous le retrouverez aussi dans « Partagés avec moi ».`,
            button: { label: `Ouvrir le ${kind}`, url },
            outro: "Janngude aide les étudiants à réviser : grandes lignes, résumés, lectures audio, quiz et assistant, à partir de leurs cours.",
            footnote: `E-mail envoyé à ${recipient} à la demande de ${sender}.`,
          }),
        });
        emailSent = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : "Envoi impossible.";
        console.error("Notification de partage non envoyée :", emailError);
      }
    }
    return Response.json({ token: share.token, url, emailSent, emailError });
  } catch (e) {
    return handleApiError(e);
  }
}
