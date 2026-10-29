"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, MoreHorizontal, Pencil, Trash2, FileText, Headphones, ListChecks, MessagesSquare, LayoutList, Paperclip, Layers, Share2 } from "lucide-react";
import { ShareDialog } from "@/components/share/share-dialog";
import { Tabs, TabsDock, TabsDockTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiJson } from "@/lib/client";
import { formatBytes, formatDate } from "@/lib/utils";
import { OverviewPanel } from "./overview-panel";
import { SummaryPanel } from "./summary-panel";
import { AudioPanel } from "./audio-panel";
import { QuizPanel, type QuizWithAttempts } from "./quiz-panel";
import { ChatPanel } from "./chat-panel";
import { FlashcardsPanel } from "@/components/flashcards/flashcards-panel";
import type { AudioReadingRow, ChatRow, CourseRow, SummaryRow, FlashcardRow } from "@/lib/supabase/types";

export type WorkspaceTab = "overview" | "summaries" | "audio" | "quiz" | "chat" | "flashcards";

export type WorkspaceCourse = Pick<CourseRow, "id" | "title" | "domain" | "subject" | "overview" | "outline" | "key_points" | "keywords" | "word_count" | "file_name" | "file_size" | "created_at" | "content_text">;

export function CourseWorkspace({
  course,
  summaries,
  quizzes,
  audios,
  chats,
  flashcards,
  now,
  voices,
  tts,
  ttsMaxChars,
  initialTab = "overview",
  initialChatId = null,
}: {
  course: WorkspaceCourse;
  summaries: SummaryRow[];
  quizzes: QuizWithAttempts[];
  audios: AudioReadingRow[];
  chats: ChatRow[];
  flashcards: FlashcardRow[];
  now: string;
  voices: { id: string; name: string }[];
  tts: boolean;
  ttsMaxChars: number;
  initialTab?: WorkspaceTab;
  initialChatId?: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [summaryList, setSummaryList] = useState(summaries);
  const [audioSummaryId, setAudioSummaryId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function goToAudio(summaryId?: string) {
    setAudioSummaryId(summaryId ?? null);
    setTab("audio");
  }

  async function saveMeta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiJson(`/api/courses/${course.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: String(form.get("title")).trim(), domain: String(form.get("domain")).trim(), subject: String(form.get("subject")).trim() }),
      });
      toast.success("Cours mis à jour.");
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Supprimer « ${course.title} » ainsi que ses résumés, quiz, lectures et discussions ? Cette action est définitive.`)) return;
    try {
      await apiJson(`/api/courses/${course.id}`, { method: "DELETE" });
      toast.success("Cours supprimé.");
      router.replace("/app");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Fil d’Ariane */}
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted" aria-label="Fil d’Ariane">
        <Link href="/app" className="rounded-full bg-surface px-3 py-1.5 font-medium text-ink shadow-card hover:bg-surface-2">
          Mes cours
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="rounded-full bg-surface px-3 py-1.5 shadow-card">{course.domain}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="rounded-full bg-surface px-3 py-1.5 text-ink-2 shadow-card">{course.subject}</span>
      </nav>

      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[42px]">{course.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone="mint">{course.domain}</Badge>
            <Badge tone="lavender">{course.subject}</Badge>
            {course.file_name ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" /> {course.file_name}
                {course.file_size ? ` · ${formatBytes(course.file_size)}` : ""}
              </span>
            ) : null}
            {course.word_count ? <span>· {course.word_count.toLocaleString("fr-FR")} mots</span> : null}
            <span>· Ajouté le {formatDate(course.created_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareDialog
            type="course"
            id={course.id}
            title={course.title}
            trigger={
              <Button variant="outline">
                <Share2 className="h-4 w-4" /> Partager le cours
              </Button>
            }
            downloads={[{ label: "PDF du cours", href: `/api/export/pdf?type=course&id=${course.id}`, fileName: `${course.title}.pdf` }]}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Actions sur le cours">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil /> Renommer / reclasser
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={remove}>
                <Trash2 /> Supprimer le cours
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTab)}>
        <TabsDock>
          <TabsDockTrigger value="overview" color="bg-violet" icon={<LayoutList />} label="Aperçu" />
          <TabsDockTrigger value="summaries" color="bg-sky" icon={<FileText />} label={summaryList.length ? `Résumés · ${summaryList.length}` : "Résumés"} />
          <TabsDockTrigger value="audio" color="bg-pink" icon={<Headphones />} label={audios.length ? `Écoute · ${audios.length}` : "Écoute"} />
          <TabsDockTrigger value="quiz" color="bg-lemon" icon={<ListChecks />} label={quizzes.length ? `Quiz · ${quizzes.length}` : "Quiz"} />
          <TabsDockTrigger value="chat" color="bg-mint" icon={<MessagesSquare />} label={chats.length ? `Discussion · ${chats.length}` : "Discussion"} />
          <TabsDockTrigger value="flashcards" color="bg-lavender" icon={<Layers />} label={flashcards.length ? `Cartes · ${flashcards.length}` : "Cartes"} />
        </TabsDock>

        <TabsContent value="overview" keepMounted>
          <OverviewPanel overview={course.overview} outline={course.outline ?? []} keyPoints={course.key_points ?? []} keywords={course.keywords ?? []} onNavigate={setTab} />
        </TabsContent>
        <TabsContent value="summaries" keepMounted>
          <SummaryPanel courseId={course.id} courseTitle={course.title} summaries={summaryList} onChange={setSummaryList} onListen={goToAudio} />
        </TabsContent>
        <TabsContent value="audio" keepMounted>
          <AudioPanel
            courseId={course.id}
            courseTitle={course.title}
            courseDomain={course.domain}
            courseText={course.content_text ?? ""}
            outline={course.outline ?? []}
            keyPoints={course.key_points ?? []}
            summaries={summaryList}
            initialAudios={audios}
            voices={voices}
            tts={tts}
            ttsMaxChars={ttsMaxChars}
            preselectedSummaryId={audioSummaryId}
          />
        </TabsContent>
        <TabsContent value="quiz" keepMounted>
          <QuizPanel courseId={course.id} initialQuizzes={quizzes} />
        </TabsContent>
        <TabsContent value="chat" keepMounted>
          <ChatPanel courseId={course.id} courseTitle={course.title} initialChats={chats} initialChatId={initialChatId} keywords={course.keywords ?? []} />
        </TabsContent>
        <TabsContent value="flashcards" keepMounted>
          <FlashcardsPanel courseId={course.id} initialCards={flashcards} now={now} />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Modifier le cours" size="sm">
          <form onSubmit={saveMeta} className="space-y-4">
            <Field label="Titre" htmlFor="edit-title">
              <Input id="edit-title" name="title" defaultValue={course.title} required maxLength={140} />
            </Field>
            <Field label="Formation" htmlFor="edit-domain">
              <Input id="edit-domain" name="domain" defaultValue={course.domain} required />
            </Field>
            <Field label="Matière" htmlFor="edit-subject">
              <Input id="edit-subject" name="subject" defaultValue={course.subject} required />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={saving}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
