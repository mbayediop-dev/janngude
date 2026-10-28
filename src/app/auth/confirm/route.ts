import type { NextRequest } from "next/server";
import { confirmFromEmailLink } from "@/lib/auth-confirm";

/** Confirmation d’inscription, changement d’e-mail, lien magique. */
export async function GET(request: NextRequest) {
  return confirmFromEmailLink(request, { next: "/app", errorCode: "lien_invalide" });
}
