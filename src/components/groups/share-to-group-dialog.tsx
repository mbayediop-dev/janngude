"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Share2, BookOpen, FileText, Headphones, ListChecks, MessagesSquare, Search, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { ShareResourceType } from "@/lib/supabase/types";

type Item = { id: string; title: string };
type CourseEntry = { id: string; title: string; domain: string; subject: string; summaries: Item[]; audios: Item[]; quizzes: Item[]; chats: Item[] };

const KINDS: { key: keyof Pick<CourseEntry, "summaries" | "audios" | "quizzes" | "chats">; type: ShareResourceType; label: string; icon: React.ComponentType<{ className?: string }>; bg: string }[] = [
  { key: "summaries", type: "summary", label: "Résumé", icon: FileText, bg: "bg-sky" },
  { key: "quizzes", type: "quiz", label: "Quiz", icon: ListChecks, bg: "bg-lemon" },
  { key: "audios", type: "audio", label: "Lecture audio", icon: Headphones, bg: "bg-lavender" },
  { key: "chats", type: "chat", label: "Discussion", icon: MessagesSquare, bg: "bg-mint" },
];

/** Choix de contenus de sa bibliothèque (cours complets, résumés, quiz, audios, discussions) à partager à un groupe. */
export function ShareToGroupDialog({ groupId, groupName, trigger, alreadyShared }: { groupId: string; groupName: string; trigger: React.ReactNode; alreadyShared: { type: ShareResourceType; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<CourseEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || courses) return;
    apiJson<{ courses: CourseEntry[] }>("/api/library")
      .then((d) => setCourses(d.courses))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"));
  }, [open, courses]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!courses) return [];
    if (!q) return courses;
    const match = (s: string) => s.toLowerCase().includes(q);
    return courses
      .map((c) => (match(c.title) || match(c.subject) || match(c.domain) ? c : { ...c, summaries: c.summaries.filter((i) => match(i.title)), audios: c.audios.filter((i) => match(i.title)), quizzes: c.quizzes.filter((i) => match(i.title)), chats: c.chats.filter((i) => match(i.title)) }))
      .filter((c) => match(c.title) || match(c.subject) || match(c.domain) || c.summaries.length || c.audios.length || c.quizzes.length || c.chats.length);
  }, [courses, q]);

  const key = (type: ShareResourceType, id: string) => `${type}:${id}`;
  const toggle = (type: ShareResourceType, id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      const k = key(type, id);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const sharedTitles = useMemo(() => new Set(alreadyShared.map((s) => `${s.type}:${s.title}`)), [alreadyShared]);

  async function share() {
    if (!selected.size) return;
    setSending(true);
    let done = 0;
    try {
      for (const k of selected) {
        const [type, id] = k.split(":") as [ShareResourceType, string];
        await apiJson("/api/shares", { method: "POST", body: JSON.stringify({ type, id, groupId }) });
        done++;
      }
      toast.success(`${done} contenu${done > 1 ? "s" : ""} partagé${done > 1 ? "s" : ""} au groupe « ${groupName} ».`);
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(`${e instanceof Error ? e.message : "Erreur"}${done ? ` (${done} déjà partagé${done > 1 ? "s" : ""})` : ""}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Partager au groupe « ${groupName} »`} description="Choisissez dans votre bibliothèque : les membres retrouveront ces contenus sur la page du groupe, et les scores des quiz alimenteront le classement.">
        <div className="space-y-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer par cours, matière ou titre"
              aria-label="Filtrer"
              className="h-11 w-full rounded-full bg-surface-2 pl-10 pr-4 text-[14px] text-ink outline-none placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-ink/10"
            />
          </label>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {courses === null ? (
              <p className="flex items-center gap-2 py-6 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre bibliothèque…
              </p>
            ) : visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{courses.length ? "Aucun contenu ne correspond." : "Déposez d’abord un cours : vous pourrez ensuite le partager, ainsi que ses résumés, quiz, lectures et discussions."}</p>
            ) : (
              visible.map((c) => (
                <section key={c.id} className="rounded-[22px] bg-surface-2 p-2">
                  <Row
                    icon={BookOpen}
                    bg="bg-violet"
                    label={c.title}
                    hint={`Cours complet · ${c.subject}`}
                    checked={selected.has(key("course", c.id))}
                    shared={sharedTitles.has(`course:${c.title}`)}
                    onToggle={() => toggle("course", c.id)}
                  />
                  {KINDS.map((kind) =>
                    c[kind.key].map((item) => (
                      <Row
                        key={item.id}
                        icon={kind.icon}
                        bg={kind.bg}
                        label={item.title}
                        hint={kind.label}
                        nested
                        checked={selected.has(key(kind.type, item.id))}
                        shared={sharedTitles.has(`${kind.type}:${item.title}`)}
                        onToggle={() => toggle(kind.type, item.id)}
                      />
                    )),
                  )}
                </section>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">{selected.size ? `${selected.size} sélectionné${selected.size > 1 ? "s" : ""}` : "Cochez un ou plusieurs contenus"}</span>
            <Button onClick={share} loading={sending} disabled={!selected.size}>
              <Share2 className="h-4 w-4" /> Partager au groupe
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, bg, label, hint, checked, shared, nested, onToggle }: { icon: React.ComponentType<{ className?: string }>; bg: string; label: string; hint: string; checked: boolean; shared: boolean; nested?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn("flex w-full items-center gap-3 rounded-[16px] px-3 py-2 text-left transition-colors", checked ? "bg-ink text-white" : "hover:bg-surface", nested && "ml-6 w-[calc(100%-1.5rem)]")}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", checked ? "bg-white/15 text-white" : `${bg} text-ink`)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{label}</span>
        <span className={cn("block text-[12px]", checked ? "text-white/65" : "text-muted")}>
          {hint}
          {shared ? " · déjà partagé" : ""}
        </span>
      </span>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", checked ? "border-white bg-white text-ink" : "border-line-strong")}>{checked ? <Check className="h-3.5 w-3.5" /> : null}</span>
    </button>
  );
}
