import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail, sendEmail, EmailError } from "@/lib/email";

export class AuthMailError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function describeSendError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/only send testing emails to your own email address/i.test(message)) {
    return "L’envoi d’e-mails n’est pas encore ouvert à tous : l’expéditeur Resend n’a pas de domaine vérifié. L’administrateur doit vérifier un domaine chez Resend et renseigner EMAIL_FROM.";
  }
  return `L’e-mail n’a pas pu être envoyé : ${message || "erreur inconnue"}.`;
}

/** Inscription : crée l’utilisateur (non confirmé) et envoie l’e-mail de confirmation via Resend. */
export async function sendSignupEmail(input: { email: string; password: string; fullName: string; phone?: string | null; origin: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName, ...(input.phone ? { phone: input.phone } : {}) }, redirectTo: `${input.origin}/auth/confirm` },
  });
  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) throw new AuthMailError("Un compte existe déjà avec cette adresse.", 409);
    if (/password/i.test(error.message)) throw new AuthMailError("Le mot de passe doit contenir au moins 8 caractères.", 400);
    throw new AuthMailError(error.message, 400);
  }
  const url = `${input.origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=signup&next=/app`;
  await deliver({
    to: input.email,
    subject: "Bienvenue sur Janngude : confirmez votre adresse",
    html: renderEmail({
      title: "Bienvenue sur Janngude 🎓",
      intro: "Merci de votre inscription. Confirmez votre adresse e-mail pour activer votre espace de révision et déposer votre premier cours.",
      button: { label: "Confirmer mon adresse", url },
      outro: "Ce lien est valable 24 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement ce message.",
      footnote: `Vous recevez cet e-mail parce qu’une inscription a été faite avec l’adresse ${input.email}.`,
    }),
  });
}

/** Mot de passe oublié : lien de réinitialisation envoyé via Resend. Ne révèle pas si l’adresse existe. */
export async function sendRecoveryEmail(input: { email: string; origin: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: { redirectTo: `${input.origin}/auth/confirm/recovery` },
  });
  if (error) {
    if (/not found|does not exist/i.test(error.message)) return; // adresse inconnue : silence volontaire
    throw new AuthMailError(error.message, 400);
  }
  const url = `${input.origin}/auth/confirm/recovery?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
  await deliver({
    to: input.email,
    subject: "Réinitialisez votre mot de passe Janngude",
    html: renderEmail({
      title: "Réinitialiser votre mot de passe 🔑",
      intro: "Vous avez demandé à changer votre mot de passe Janngude. Cliquez sur le bouton pour en choisir un nouveau.",
      button: { label: "Choisir un nouveau mot de passe", url },
      outro: "Ce lien est valable une heure et ne peut être utilisé qu’une fois. Si vous n’avez rien demandé, votre mot de passe reste inchangé : vous pouvez ignorer ce message.",
      footnote: `Demande reçue pour le compte ${input.email}.`,
    }),
  });
}

/** Renvoi de la confirmation pour un compte existant non confirmé (lien de connexion, qui confirme l’adresse). */
export async function resendConfirmationEmail(input: { email: string; origin: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: { redirectTo: `${input.origin}/auth/confirm` },
  });
  if (error) {
    if (/not found|does not exist/i.test(error.message)) return;
    throw new AuthMailError(error.message, 400);
  }
  const url = `${input.origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=/app`;
  await deliver({
    to: input.email,
    subject: "Confirmez votre adresse Janngude",
    html: renderEmail({
      title: "Confirmer votre adresse ✉️",
      intro: "Cliquez sur le bouton pour confirmer votre adresse et accéder à votre espace Janngude.",
      button: { label: "Confirmer et me connecter", url },
      outro: "Ce lien est valable une heure et ne peut être utilisé qu’une fois.",
      footnote: `Demande reçue pour le compte ${input.email}.`,
    }),
  });
}

async function deliver(mail: { to: string; subject: string; html: string }) {
  try {
    await sendEmail(mail);
  } catch (error) {
    if (error instanceof EmailError) throw new AuthMailError(describeSendError(error), 502);
    throw error;
  }
}
