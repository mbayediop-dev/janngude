"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Copy, MessageCircle, Crown, UserMinus, LogOut, Trash2, Pencil, Users, Share2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { SharedCard } from "@/components/share/shared-card";
import { ShareToGroupDialog } from "@/components/groups/share-to-group-dialog";
import { apiJson, copyToClipboard } from "@/lib/client";
import { whatsappUrl } from "@/lib/share";
import { groupInviteMessage } from "@/lib/groups";
import { formatDate } from "@/lib/utils";
import type { GroupLeaderboardRow, GroupMemberInfo, GroupRow, GroupShareInfo } from "@/lib/supabase/types";
import { Khadija } from "@/components/brand/khadija";

export function GroupView({ group, viewerId, members, shares, leaderboard }: { group: GroupRow; viewerId: string; members: GroupMemberInfo[]; shares: GroupShareInfo[]; leaderboard: GroupLeaderboardRow[] }) {
  const router = useRouter();
  const isOwner = group.owner_id === viewerId;
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const invite = groupInviteMessage(group.name, group.code);

  async function rename() {
    setBusy(true);
    try {
      await apiJson(`/api/groups/${group.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      toast.success("Groupe renommé.");
      setRenameOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function leaveOrDelete() {
    const question = isOwner ? `Supprimer le groupe « ${group.name} » pour tous ses membres ? Les contenus partagés restent accessibles par leurs liens.` : `Quitter le groupe « ${group.name} » ?`;
    if (!confirm(question)) return;
    try {
      await apiJson(`/api/groups/${group.id}`, { method: "DELETE" });
      toast.success(isOwner ? "Groupe supprimé." : "Vous avez quitté le groupe.");
      router.replace("/app/groups");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function removeMember(m: GroupMemberInfo) {
    if (!confirm(`Retirer ${m.name} du groupe ?`)) return;
    try {
      await apiJson(`/api/groups/${group.id}`, { method: "POST", body: JSON.stringify({ action: "remove", userId: m.user_id }) });
      toast.success(`${m.name} a été retiré du groupe.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  const ranked = leaderboard.filter((r) => r.attempts > 0);

  return (
    <div className="animate-fade-in">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted" aria-label="Fil d’Ariane">
        <Link href="/app/groups" className="rounded-full bg-surface px-3 py-1.5 font-medium text-ink shadow-card hover:bg-surface-2">
          Groupes
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="rounded-full bg-surface px-3 py-1.5 text-ink-2 shadow-card">{group.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[42px]">
            {group.name}&nbsp;<span className="align-middle">👥</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone="mint">
              <Users className="h-3.5 w-3.5" /> {members.length} membre{members.length > 1 ? "s" : ""}
            </Badge>
            {isOwner ? (
              <Badge tone="lemon">
                <Crown className="h-3.5 w-3.5" /> Vous êtes le créateur
              </Badge>
            ) : null}
            <span>· Créé le {formatDate(group.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareToGroupDialog
            groupId={group.id}
            groupName={group.name}
            alreadyShared={shares.map((s) => ({ type: s.resource_type, title: s.title }))}
            trigger={
              <Button>
                <Share2 className="h-4 w-4" /> Partager un contenu
              </Button>
            }
          />
          {isOwner ? (
            <Button variant="outline" onClick={() => setRenameOpen(true)}>
              <Pencil className="h-4 w-4" /> Renommer
            </Button>
          ) : null}
          <Button variant="outline" onClick={leaveOrDelete} className="text-danger">
            {isOwner ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />} {isOwner ? "Supprimer" : "Quitter"}
          </Button>
        </div>
      </div>

      {/* Invitation */}
      <div className="mb-10 flex flex-col gap-4 rounded-[28px] bg-lemon p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Khadija pose="phone" className="hidden h-28 w-28 shrink-0 sm:block" />
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-ink-2/70">Code d’invitation</p>
            <p className="mt-1 font-mono text-[34px] font-semibold tracking-[0.3em] text-ink">{group.code}</p>
            <p className="text-sm text-ink-2/80">Vos camarades le saisissent dans « Groupes » → « Rejoindre avec un code ».</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="white" onClick={() => copyToClipboard(group.code, "Code copié")}>
            <Copy className="h-4 w-4" /> Copier le code
          </Button>
          <Button asChild variant="white">
            <a href={whatsappUrl(invite)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 text-[#25D366]" /> Inviter sur WhatsApp
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <h2 className="mb-5 flex items-center gap-2 text-[26px] font-semibold tracking-tight text-ink">
            <Share2 className="h-6 w-6" /> Contenus partagés au groupe
          </h2>
          {shares.length === 0 ? (
            <div className="rounded-[28px] border-2 border-dashed border-line-strong px-6 py-12 text-center">
              <Inbox className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-3 text-[15px] font-medium text-ink">Rien n’a encore été partagé ici.</p>
              <p className="mt-1 text-sm text-muted">Cliquez sur « Partager un contenu » pour choisir dans votre bibliothèque : cours complets, résumés, quiz, lectures audio ou discussions avec l’assistant.</p>
              <div className="mt-5">
                <ShareToGroupDialog
                  groupId={group.id}
                  groupName={group.name}
                  alreadyShared={[]}
                  trigger={
                    <Button variant="secondary">
                      <Share2 className="h-4 w-4" /> Partager un contenu
                    </Button>
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {shares.map((s) => (
                <SharedCard key={s.share_id} share={{ ...s, saved_at: null }} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-8">
          <div>
            <h2 className="mb-4 flex items-center gap-3 text-[22px] font-semibold tracking-tight text-ink">
              <Khadija pose="trophy" className="-my-2 h-14 w-14" /> Classement des quiz
            </h2>
            {ranked.length === 0 ? (
              <p className="rounded-[22px] bg-surface p-5 text-sm text-muted shadow-card">Partagez un quiz au groupe : les scores de chacun apparaîtront ici.</p>
            ) : (
              <ol className="overflow-hidden rounded-[26px] bg-surface shadow-card">
                {ranked.map((r, i) => (
                  <li key={r.user_id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                    <span className="w-6 text-center text-[15px] font-semibold text-ink">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                    <Avatar name={r.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{r.name}{r.user_id === viewerId ? " (vous)" : ""}</span>
                      <span className="block text-[12px] text-muted">{r.attempts} tentative{r.attempts > 1 ? "s" : ""} · moyenne {r.avg_percent ?? 0} %</span>
                    </span>
                    <Badge tone="mint">{r.best_percent ?? 0} %</Badge>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <h2 className="mb-4 flex items-center gap-2 text-[22px] font-semibold tracking-tight text-ink">
              <Users className="h-5 w-5" /> Membres
            </h2>
            <ul className="overflow-hidden rounded-[26px] bg-surface shadow-card">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                  <Avatar name={m.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{m.name}{m.user_id === viewerId ? " (vous)" : ""}</span>
                    <span className="block text-[12px] text-muted">{m.role === "owner" ? "Créateur" : `Membre depuis le ${formatDate(m.joined_at)}`}</span>
                  </span>
                  {isOwner && m.role !== "owner" ? (
                    <button type="button" onClick={() => removeMember(m)} className="rounded-full p-2 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Retirer ${m.name}`}>
                      <UserMinus className="h-4 w-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="Renommer le groupe">
          <Field label="Nom du groupe" htmlFor="group-name">
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Annuler
            </Button>
            <Button onClick={rename} loading={busy}>
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
