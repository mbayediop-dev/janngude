"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Download, Link2, MessageCircle, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Divider } from "@/components/ui/misc";
import { StudentPicker } from "@/components/share/student-picker";
import { apiJson, copyToClipboard } from "@/lib/client";
import { shareMessage, whatsappUrl, SHARE_TYPE_LABEL } from "@/lib/share";
import type { GroupSummary } from "@/lib/groups";
import type { ShareResourceType, StudentMatch } from "@/lib/supabase/types";

export type DownloadOption = { label: string; href: string; fileName?: string };

export function ShareDialog({
  type,
  id,
  title,
  trigger,
  downloads = [],
}: {
  type: ShareResourceType;
  id: string;
  title: string;
  trigger: React.ReactNode;
  downloads?: DownloadOption[];
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [groupId, setGroupId] = useState("");
  const [sharingGroup, setSharingGroup] = useState(false);

  useEffect(() => {
    if (!open || url) return;
    apiJson<{ url: string }>("/api/shares", { method: "POST", body: JSON.stringify({ type, id }) })
      .then((d) => setUrl(d.url))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"));
  }, [open, url, type, id]);

  useEffect(() => {
    if (!open || groups) return;
    apiJson<{ groups: GroupSummary[] }>("/api/groups")
      .then((d) => setGroups(d.groups))
      .catch(() => setGroups([]));
  }, [open, groups]);

  async function sendToStudent(email: string, student: StudentMatch | null) {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return toast.error("Choisissez un étudiant dans la liste, ou saisissez son adresse e-mail complète.");
    const who = student ? student.name : value;
    setSending(true);
    try {
      const result = await apiJson<{ emailSent: boolean; emailError: string | null }>("/api/shares", { method: "POST", body: JSON.stringify({ type, id, recipientEmail: value }) });
      if (result.emailSent) toast.success(`E-mail envoyé à ${who}. Le contenu apparaîtra aussi dans sa rubrique « Partagés avec moi ».`);
      else if (result.emailError) toast.warning(`Ajouté à l’espace de ${who}, mais l’e-mail n’a pas pu être envoyé : ${result.emailError}`);
      else toast.success(`Ajouté à l’espace de ${who}. Le contenu apparaîtra dans « Partagés avec moi ».`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  async function shareToGroup() {
    const group = groups?.find((g) => g.id === groupId);
    if (!group) return toast.error("Choisissez un groupe.");
    setSharingGroup(true);
    try {
      await apiJson("/api/shares", { method: "POST", body: JSON.stringify({ type, id, groupId }) });
      toast.success(`Partagé au groupe « ${group.name} ». Ses membres le retrouveront sur la page du groupe.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSharingGroup(false);
    }
  }

  const message = url ? shareMessage(type, title, url) : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Partager ce ${SHARE_TYPE_LABEL[type].toLowerCase()}`} description="Toute personne disposant du lien peut consulter ce contenu, avec ou sans compte.">
        <div className="space-y-5">
          <div>
            <Label>Lien de partage</Label>
            <div className="flex gap-2">
              <Input readOnly value={url ?? "Génération du lien…"} onFocus={(e) => e.currentTarget.select()} className="font-mono text-[13px]" />
              <Button variant="outline" onClick={() => url && copyToClipboard(url, "Lien copié")} disabled={!url} aria-label="Copier le lien">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button asChild variant="outline" disabled={!url} className="justify-start">
              <a href={url ? whatsappUrl(message) : "#"} target="_blank" rel="noopener noreferrer" aria-disabled={!url}>
                <MessageCircle className="h-4 w-4 text-[#25D366]" /> WhatsApp
              </a>
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => url && copyToClipboard(message, "Message copié")} disabled={!url}>
              <Link2 className="h-4 w-4" /> Copier le message
            </Button>
            {downloads.map((d) => (
              <Button key={d.href} asChild variant="outline" className="justify-start">
                <a href={d.href} download={d.fileName}>
                  <Download className="h-4 w-4" /> {d.label}
                </a>
              </Button>
            ))}
          </div>

          <Divider label="ou" />

          <div>
            <Label htmlFor="share-student">Ajouter à l’espace d’un étudiant Janngude</Label>
            <StudentPicker inputId="share-student" onSubmit={sendToStudent} loading={sending} />
            <p className="mt-1.5 text-[12px] text-muted">Tapez son prénom, son nom, son téléphone ou son e-mail. Il reçoit un e-mail avec le lien, et le contenu apparaît dans sa rubrique « Partagés avec moi ».</p>
          </div>

          <div>
            <Label htmlFor="share-group">Partager à un groupe de classe</Label>
            {groups && groups.length > 0 ? (
              <>
                <div className="flex gap-2">
                  <Select id="share-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    <option value="" disabled>
                      Choisir un groupe…
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} · {g.members} membre{g.members > 1 ? "s" : ""}
                      </option>
                    ))}
                  </Select>
                  <Button onClick={shareToGroup} loading={sharingGroup} disabled={!groupId} variant="secondary">
                    <Users className="h-4 w-4" /> Partager
                  </Button>
                </div>
                <p className="mt-1.5 text-[12px] text-muted">Tous les membres le voient sur la page du groupe ; les scores d’un quiz alimentent le classement.</p>
              </>
            ) : (
              <p className="text-[13px] text-muted">
                {groups === null ? "Chargement de vos groupes…" : (
                  <>
                    Vous n’êtes dans aucun groupe.{" "}
                    <Link href="/app/groups" className="font-medium text-ink underline hover:no-underline">
                      Créer ou rejoindre un groupe
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
