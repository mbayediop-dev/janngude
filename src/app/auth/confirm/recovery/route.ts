import type { NextRequest } from "next/server";
import { confirmFromEmailLink } from "@/lib/auth-confirm";

/** Lien « mot de passe oublié » : ouvre une session temporaire puis la page de nouveau mot de passe. */
export async function GET(request: NextRequest) {
  return confirmFromEmailLink(request, { next: "/reset-password", type: "recovery", errorCode: "lien_reinitialisation_invalide" });
}
