"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="rounded-2xl shadow-float">
      <CardContent className="px-8 py-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-7">{children}</div>
      </CardContent>
      {footer ? <div className="border-t border-line px-8 py-4 text-center text-sm text-muted">{footer}</div> : null}
    </Card>
  );
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

/**
 * Appelle une route d’e-mail de l’application (envoi via Resend). Renvoie `null` si l’envoi applicatif
 * n’est pas configuré (503) : l’appelant retombe alors sur l’envoi Supabase.
 */
async function appMail(path: string, payload: Record<string, string>): Promise<{ ok: true } | { ok: false; message: string } | null> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (res.status === 503) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return res.ok ? { ok: true } : { ok: false, message: data.error ?? `Erreur ${res.status}` };
}

/** Traduction des erreurs Supabase les plus courantes. */
function describeAuthError(error: { message: string; code?: string }) {
  const code = error.code ?? "";
  const message = error.message;
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(message)) {
    return "Limite d’envoi d’e-mails atteinte pour le moment (service d’e-mail de test de Supabase : deux envois par heure). Réessayez dans une heure, ou demandez à l’administrateur d’activer l’envoi via Resend.";
  }
  if (message === "Invalid login credentials") return "E-mail ou mot de passe incorrect.";
  if (message === "Email not confirmed") return "Confirmez votre adresse e-mail avant de vous connecter.";
  if (message === "User already registered") return "Un compte existe déjà avec cette adresse.";
  if (/password should be at least/i.test(message)) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (/signups not allowed/i.test(message)) return "Les inscriptions sont fermées pour le moment.";
  return message;
}

const LINK_ERRORS: Record<string, string> = {
  lien_invalide: "Ce lien est invalide ou a expiré. Connectez-vous ou demandez un nouveau lien.",
  lien_reinitialisation_invalide: "Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau via « Mot de passe oublié ? ».",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = params.get("error");
    return code ? (LINK_ERRORS[code] ?? "Une erreur est survenue avec ce lien.") : null;
  });

  async function resendConfirmation() {
    if (!unconfirmed) return;
    setResending(true);
    let result = await appMail("/api/auth/resend-confirmation", { email: unconfirmed }).catch(() => null);
    if (!result) {
      // Envoi applicatif non configuré : renvoi par Supabase.
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email: unconfirmed });
      result = error ? { ok: false, message: describeAuthError(error) } : { ok: true };
    }
    setResending(false);
    if (result.ok) toast.success("E-mail de confirmation renvoyé. Vérifiez votre boîte de réception.");
    else toast.error(result.message);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: String(form.get("password")),
    });
    setLoading(false);
    if (error) {
      setError(describeAuthError(error));
      if (error.message === "Email not confirmed") setUnconfirmed(email);
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <AuthCard
      title="Bon retour"
      subtitle="Connectez-vous pour retrouver votre espace."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-ink underline hover:no-underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Adresse e-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-medium text-ink-2">
              Mot de passe
            </label>
            <Link href="/forgot-password" className="text-[13px] text-muted hover:text-ink">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error ? (
          <div className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
            {unconfirmed ? (
              <button type="button" onClick={resendConfirmation} disabled={resending} className="mt-2 block font-medium underline underline-offset-2 hover:no-underline disabled:opacity-60">
                {resending ? "Envoi…" : "Renvoyer l’e-mail de confirmation"}
              </button>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const fullName = String(form.get("full_name")).trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError("Numéro de téléphone invalide. Exemple : 77 123 45 67 ou +221 77 123 45 67.");
      return;
    }
    const normalizedPhone = normalizePhone(phone) ?? "";
    setLoading(true);
    // Envoi par l’application (Resend) ; repli sur l’envoi Supabase si non configuré.
    const viaApp = await appMail("/api/auth/signup", { fullName, email, password, phone: normalizedPhone }).catch(() => null);
    if (viaApp) {
      setLoading(false);
      if (!viaApp.ok) {
        setError(viaApp.message);
        return;
      }
      setSent(email);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: normalizedPhone },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setLoading(false);
    if (error) {
      setError(describeAuthError(error));
      return;
    }
    if (data.session) {
      router.replace("/app");
      router.refresh();
      return;
    }
    setSent(email);
  }

  if (sent) {
    return (
      <AuthCard title="Vérifiez votre boîte mail" subtitle={`Nous avons envoyé un lien de confirmation à ${sent}.`}>
        <p className="text-sm text-ink-2">Cliquez sur le lien pour activer votre compte, puis connectez-vous.</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/login">Aller à la connexion</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Créer votre espace"
      subtitle="Gratuit. Vos cours restent privés, vous choisissez ce que vous partagez."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-medium text-ink underline hover:no-underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nom complet" htmlFor="full_name">
          <Input id="full_name" name="full_name" autoComplete="name" required placeholder="Aminata Diallo" />
        </Field>
        <Field label="Adresse e-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com" />
        </Field>
        <Field label="Téléphone" htmlFor="phone" hint="Facultatif. Permet à vos camarades de vous retrouver pour partager un contenu.">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="77 123 45 67" />
        </Field>
        <Field label="Mot de passe" htmlFor="password" hint="8 caractères minimum.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        {error ? <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Créer mon compte
        </Button>
        <p className="text-center text-[12px] text-muted">En continuant, vous acceptez nos conditions d’utilisation.</p>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const viaApp = await appMail("/api/auth/forgot", { email }).catch(() => null);
    if (viaApp) {
      setLoading(false);
      if (!viaApp.ok) {
        toast.error(viaApp.message);
        return;
      }
      setDone(true);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm/recovery`,
    });
    setLoading(false);
    if (error) {
      toast.error(describeAuthError(error));
      return;
    }
    setDone(true);
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle={done ? "Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé." : "Indiquez votre e-mail : nous vous enverrons un lien de réinitialisation."}
      footer={
        <Link href="/login" className="font-medium text-ink underline hover:no-underline">
          Retour à la connexion
        </Link>
      }
    >
      {done ? null : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Adresse e-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  // Le lien reçu par e-mail ouvre une session temporaire : sans elle, la page n’a pas de sens.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password.length < 8) return toast.error("8 caractères minimum.");
    if (password !== confirm) return toast.error("Les deux mots de passe ne correspondent pas.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "New password should be different from the old password." ? "Choisissez un mot de passe différent de l’ancien." : error.message);
      return;
    }
    toast.success("Mot de passe mis à jour. Vous êtes connecté.");
    router.replace("/app");
    router.refresh();
  }

  if (ready === false) {
    return (
      <AuthCard title="Lien expiré" subtitle="Ce lien de réinitialisation n’est plus valable. Demandez-en un nouveau.">
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">Recevoir un nouveau lien</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={ready === null}>
          Enregistrer
        </Button>
      </form>
    </AuthCard>
  );
}
