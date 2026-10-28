"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { apiJson } from "@/lib/client";
import { formatPhone, isValidPhone } from "@/lib/phone";

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextPhone = String(form.get("phone") ?? "").trim();
    if (nextPhone && !isValidPhone(nextPhone)) return toast.error("Numéro de téléphone invalide. Exemple : 77 123 45 67 ou +221 77 123 45 67.");
    setLoading(true);
    try {
      await apiJson("/api/profile", { method: "PATCH", body: JSON.stringify({ full_name: String(form.get("full_name")).trim(), phone: nextPhone }) });
      toast.success("Profil mis à jour.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Nom complet" htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={name} required />
      </Field>
      <Field label="Téléphone" htmlFor="phone" hint="Vos camarades peuvent vous retrouver avec ce numéro pour vous partager un contenu.">
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={formatPhone(phone)} placeholder="77 123 45 67" />
      </Field>
      <Field label="Adresse e-mail" htmlFor="email" hint="L’adresse de connexion ne peut pas être modifiée ici.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Button type="submit" loading={loading}>
        Enregistrer
      </Button>
    </form>
  );
}
