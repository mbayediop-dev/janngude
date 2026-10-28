import { jsonError, readJsonBody } from "@/lib/api";
import { sendRecoveryEmail } from "@/lib/auth-mail";
import { EMAIL_RE, authMailErrorResponse, originOf, requireAppMail, throttle } from "../_shared";

export async function POST(request: Request) {
  const notReady = requireAppMail();
  if (notReady) return notReady;
  try {
    const body = await readJsonBody<{ email?: string }>(request);
    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return jsonError("Adresse e-mail invalide.");
    if (throttle(request, "forgot", email)) return jsonError("Trop de tentatives. Réessayez dans quelques minutes.", 429);
    await sendRecoveryEmail({ email, origin: originOf(request) });
    return Response.json({ ok: true });
  } catch (error) {
    return authMailErrorResponse(error);
  }
}
