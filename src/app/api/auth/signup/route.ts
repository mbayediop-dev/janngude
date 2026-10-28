import { jsonError, readJsonBody } from "@/lib/api";
import { sendSignupEmail } from "@/lib/auth-mail";
import { normalizePhone } from "@/lib/phone";
import { EMAIL_RE, authMailErrorResponse, originOf, requireAppMail, throttle } from "../_shared";

export async function POST(request: Request) {
  const notReady = requireAppMail();
  if (notReady) return notReady;
  try {
    const body = await readJsonBody<{ fullName?: string; email?: string; password?: string; phone?: string }>(request);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = (body.fullName ?? "").trim().slice(0, 80);
    const rawPhone = (body.phone ?? "").trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (!EMAIL_RE.test(email)) return jsonError("Adresse e-mail invalide.");
    if (password.length < 8) return jsonError("Le mot de passe doit contenir au moins 8 caractères.");
    if (!fullName) return jsonError("Indiquez votre nom.");
    if (rawPhone && !phone) return jsonError("Numéro de téléphone invalide.");
    if (throttle(request, "signup", email)) return jsonError("Trop de tentatives. Réessayez dans quelques minutes.", 429);
    await sendSignupEmail({ email, password, fullName, phone, origin: originOf(request) });
    return Response.json({ ok: true });
  } catch (error) {
    return authMailErrorResponse(error);
  }
}
