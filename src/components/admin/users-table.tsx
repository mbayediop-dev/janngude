"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, Search, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { apiJson } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import type { AdminUser } from "@/lib/supabase/types";

export function UsersTable({ users, query, selfId, canDelete, canImpersonate }: { users: AdminUser[]; query: string; selfId: string; canDelete: boolean; canImpersonate: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setRole(u: AdminUser, role: "student" | "admin") {
    if (role === "admin" && !confirm(`Donner les droits d’administration à ${u.name} (${u.email}) ?`)) return;
    setBusy(u.id);
    try {
      await apiJson(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      toast.success(role === "admin" ? `${u.name} est maintenant administrateur.` : `${u.name} n’est plus administrateur.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  /** Ouvre l’espace de l’étudiant dans ce navigateur ; la page entière est rechargée avec sa session. */
  async function enter(u: AdminUser) {
    if (!confirm(`Ouvrir l’espace de ${u.name} (${u.email}) ?\n\nVous verrez et pourrez modifier ses contenus comme si vous étiez cette personne. Un bandeau vous permettra de revenir à votre compte.`)) return;
    setBusy(u.id);
    try {
      const { redirect } = await apiJson<{ redirect: string }>(`/api/admin/users/${u.id}/impersonate`, { method: "POST" });
      window.location.assign(redirect);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setBusy(null);
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Supprimer définitivement le compte de ${u.name} (${u.email}) et toutes ses données ?`)) return;
    setBusy(u.id);
    try {
      await apiJson(`/api/admin/users/${u.id}`, { method: "DELETE" });
      toast.success("Compte supprimé.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <form method="get" className="relative block w-full sm:w-96">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          name="q"
          defaultValue={query}
          placeholder="Rechercher un nom, un e-mail ou un téléphone"
          aria-label="Rechercher un compte"
          className="h-12 w-full rounded-full bg-surface pl-12 pr-5 text-[15px] text-ink shadow-card outline-none placeholder:text-muted focus:ring-2 focus:ring-ink/10"
        />
      </form>

      <div className="overflow-x-auto rounded-[26px] bg-surface shadow-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-surface-2 text-[12px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Étudiant</th>
              <th className="px-3 py-3 font-medium">Rôle</th>
              <th className="px-3 py-3 font-medium">Inscription</th>
              <th className="px-3 py-3 font-medium">Dernière connexion</th>
              <th className="px-3 py-3 text-right font-medium">Cours</th>
              <th className="px-3 py-3 text-right font-medium">Audios</th>
              <th className="px-3 py-3 text-right font-medium">Car. voix</th>
              <th className="px-3 py-3 text-right font-medium">Car. IA</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-muted">
                  Aucun compte ne correspond.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {u.name}
                          {u.id === selfId ? " (vous)" : ""}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {u.email}
                          {u.phone ? ` · ${formatPhone(u.phone)}` : ""}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3">{u.role === "admin" ? <Badge tone="lemon">Admin</Badge> : <Badge tone="neutral">Étudiant</Badge>}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-3 text-muted">{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{u.courses}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{u.audios}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{u.tts_chars.toLocaleString("fr-FR")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{u.ai_chars.toLocaleString("fr-FR")}</td>
                  <td className="px-5 py-3">
                    <span className="flex justify-end gap-1">
                      <button type="button" disabled={busy === u.id || u.id === selfId || !canImpersonate} onClick={() => enter(u)} className="rounded-full p-2 text-muted hover:bg-mint hover:text-ink disabled:opacity-40" title={canImpersonate ? "Se connecter à ce compte" : "Définissez SUPABASE_SECRET_KEY pour ouvrir un compte"}>
                        <LogIn className="h-4 w-4" />
                      </button>
                      {u.role === "admin" ? (
                        <button type="button" disabled={busy === u.id || u.id === selfId} onClick={() => setRole(u, "student")} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40" title="Retirer les droits d’administration">
                          <ShieldOff className="h-4 w-4" />
                        </button>
                      ) : (
                        <button type="button" disabled={busy === u.id} onClick={() => setRole(u, "admin")} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40" title="Nommer administrateur">
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" disabled={busy === u.id || u.id === selfId || !canDelete} onClick={() => remove(u)} className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40" title={canDelete ? "Supprimer le compte" : "Définissez SUPABASE_SECRET_KEY pour supprimer des comptes"}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!canDelete ? <p className="text-[12px] text-muted">La suppression de comptes et la connexion à un compte nécessitent la variable SUPABASE_SECRET_KEY côté serveur.</p> : null}
    </div>
  );
}
