"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Plus, KeyRound, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CornerBubble } from "@/components/ui/misc";
import { Khadija } from "@/components/brand/khadija";
import { apiJson } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { GroupSummary } from "@/lib/groups";

const PASTELS = ["bg-mint", "bg-sky", "bg-lavender", "bg-lemon", "bg-pink"];

export function GroupsHome({ groups, initialCode }: { groups: GroupSummary[]; initialCode: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  async function create() {
    if (name.trim().length < 2) return toast.error("Donnez un nom au groupe.");
    setCreating(true);
    try {
      const { id, code: newCode } = await apiJson<{ id: string; code: string }>("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      toast.success(`Groupe créé. Code d’invitation : ${newCode}`);
      router.push(`/app/groups/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setCreating(false);
    }
  }

  async function join() {
    if (code.trim().length < 4) return toast.error("Saisissez le code du groupe.");
    setJoining(true);
    try {
      const { id } = await apiJson<{ id: string }>("/api/groups", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
      toast.success("Vous avez rejoint le groupe.");
      router.push(`/app/groups/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setJoining(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="relative rounded-[28px] bg-surface p-7 shadow-card">
          <CornerBubble className="bg-mint">
            <Plus className="h-5 w-5" />
          </CornerBubble>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">Créer un groupe</h2>
          <p className="mt-1 text-sm text-muted">Vous recevrez un code à transmettre à vos camarades (WhatsApp, lien…).</p>
          <div className="mt-4 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. L2 Droit — groupe 3" maxLength={80} onKeyDown={(e) => e.key === "Enter" && create()} />
            <Button onClick={create} loading={creating}>
              Créer
            </Button>
          </div>
        </div>
        <div className="relative rounded-[28px] bg-surface p-7 shadow-card">
          <CornerBubble className="bg-lemon">
            <KeyRound className="h-5 w-5" />
          </CornerBubble>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">Rejoindre avec un code</h2>
          <p className="mt-1 text-sm text-muted">Le code à six caractères vous a été transmis par le créateur du groupe.</p>
          <div className="mt-4 flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex. 7F3A9C" maxLength={12} className="font-mono uppercase tracking-widest" onKeyDown={(e) => e.key === "Enter" && join()} />
            <Button onClick={join} loading={joining} variant="secondary">
              Rejoindre
            </Button>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-5 text-[26px] font-semibold tracking-tight text-ink">
          Mes groupes&nbsp;<span className="align-middle">🤝</span>
        </h2>
        {groups.length === 0 ? (
          <div className="rounded-[28px] border-2 border-dashed border-line-strong px-6 py-14 text-center">
            <Khadija pose="friends" className="mx-auto h-32 w-32" />
            <p className="mt-4 text-[15px] font-medium text-ink">Vous n’êtes dans aucun groupe pour l’instant.</p>
            <p className="mt-1 text-sm text-muted">Créez-en un pour votre classe ou rejoignez celui d’un camarade.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g, i) => (
              <Link key={g.id} href={`/app/groups/${g.id}`} className={cn("group relative block rounded-[26px] p-5 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float", PASTELS[i % PASTELS.length])}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[14px] font-medium text-ink">
                    <Users className="h-4 w-4" /> {g.members} membre{g.members > 1 ? "s" : ""}
                  </span>
                  {g.role === "owner" ? (
                    <Badge className="bg-white/80 text-ink">
                      <Crown className="h-3.5 w-3.5" /> Créateur
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-4 text-[22px] font-semibold leading-tight tracking-tight text-ink">{g.name}</p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-[13px] tracking-widest text-ink">{g.code}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
