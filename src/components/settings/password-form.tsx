"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function PasswordForm({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const current = String(form.get("current"));
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password.length < 8) return toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return toast.error("Les deux nouveaux mots de passe ne correspondent pas.");
    if (password === current) return toast.error("Choisissez un mot de passe différent de l’actuel.");

    setLoading(true);
    const supabase = createClient();
    // Vérifie le mot de passe actuel avant de le remplacer.
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (checkError) {
      setLoading(false);
      toast.error("Le mot de passe actuel est incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe modifié.");
    formEl.reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Mot de passe actuel" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="new-password" hint="8 caractères minimum.">
        <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirmer le nouveau mot de passe" htmlFor="confirm-password">
        <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Button type="submit" loading={loading}>
        Modifier le mot de passe
      </Button>
    </form>
  );
}
