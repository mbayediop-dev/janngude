"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookmarkPlus, Check, Copy, Download, MessageCircle, Sparkles, UserRound, Play, FolderInput, Lightbulb, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { QuizRunner } from "@/components/share/quiz-runner";
import { apiJson, audioPublicUrl, copyToClipboard, transcriptPublicUrl } from "@/lib/client";
import { AudioPlayerDialog } from "@/components/audio/audio-player";
import { shareMessage, whatsappUrl, SHARE_TYPE_LABEL } from "@/lib/share";
import { formatDate, formatDuration } from "@/lib/utils";
import type { GradeResult, SharePayload } from "@/lib/supabase/types";
import { KhadijaFigure } from "@/components/brand/khadija";

const SOURCE_LABEL: Record<string, string> = { course: "Lecture du cours", summary: "Lecture d’un résumé", outline: "Lecture des grandes lignes", keypoints: "Lecture des points à retenir", podcast: "Podcast à deux voix" };

export function SharedView({ payload, viewer, url }: { payload: SharePayload; viewer: { id: string; name: string } | null; url: string }) {
  const router = useRouter();
  const { share, resource } = payload;
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  /** Reprend la discussion partagée dans son espace pour poser ses propres questions à l’assistant. */
  async function continueChat() {
    setContinuing(true);
    try {
      const r = await apiJson<{ courseId: string; chatId: string; created: boolean }>(`/api/shares/${share.token}/continue`, { method: "POST" });
      toast.success(r.created ? "Discussion copiée dans votre espace : posez votre question à l’assistant." : "Vous reprenez cette discussion dans votre espace.");
      router.push(`/app/courses/${r.courseId}?tab=chat&chat=${r.chatId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setContinuing(false);
    }
  }

  async function copyCourse() {
    setCopying(true);
    try {
      const { id } = await apiJson<{ id: string }>(`/api/shares/${share.token}/copy`, { method: "POST" });
      toast.success("Cours copié dans votre espace : résumés, quiz, lectures et cartes sont à vous.");
      router.push(`/app/courses/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setCopying(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await apiJson(`/api/shares/${share.token}/save`, { method: "POST" });
      setSaved(true);
      toast.success("Ajouté à « Partagés avec moi ».");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const message = shareMessage(share.type, share.title, url);
  const download =
    share.type === "audio" && "file_path" in resource
      ? { href: audioPublicUrl(resource.file_path), label: "Télécharger le MP3", fileName: `${share.title}.mp3` }
      : share.type === "summary" || share.type === "quiz" || share.type === "chat" || share.type === "course"
        ? { href: `/api/export/pdf?token=${share.token}`, label: "Télécharger en PDF", fileName: undefined }
        : null;

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] bg-surface p-6 shadow-card sm:p-8">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <Badge tone="primary">{SHARE_TYPE_LABEL[share.type]}</Badge>
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[36px]">{share.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {resource.course.domain} · {resource.course.subject} · partagé par <span className="font-medium text-ink-2">{share.owner_name}</span> le {formatDate(share.created_at)}
            </p>
          </div>
        </div>
        <KhadijaFigure layout="row" pose="point" size="sm" className="mt-5 max-w-xl">
          {viewer ? "Enregistrez ce contenu dans votre espace : vous le retrouverez dans « Partagés avec moi »." : "Créez votre espace gratuit pour enregistrer ce contenu et poser vos questions sur le cours."}
        </KhadijaFigure>
        <div className="mt-6 flex flex-wrap gap-2">
          {viewer && share.type === "course" ? (
            <Button onClick={copyCourse} loading={copying}>
              <FolderInput className="h-4 w-4" /> Copier dans mes cours
            </Button>
          ) : null}
          {viewer ? (
            <Button onClick={save} loading={saving} disabled={saved} variant={share.type === "course" ? "outline" : "primary"}>
              {saved ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
              {saved ? "Enregistré dans mon espace" : "Enregistrer dans mon espace"}
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/signup?next=${encodeURIComponent(`/s/${share.token}`)}`}>
                <Sparkles className="h-4 w-4" /> Créer mon espace gratuit
              </Link>
            </Button>
          )}
          {download ? (
            <Button asChild variant="outline">
              <a href={download.href} download={download.fileName}>
                <Download className="h-4 w-4" /> {download.label}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 text-[#25D366]" /> WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={() => copyToClipboard(url, "Lien copié")}>
            <Copy className="h-4 w-4" /> Copier le lien
          </Button>
        </div>
      </header>

      {share.type === "summary" && "content" in resource ? (
        <article className="rounded-[28px] bg-surface px-6 py-6 shadow-card sm:px-10 sm:py-8">
          <Markdown content={resource.content} />
        </article>
      ) : null}

      {share.type === "course" && "outline" in resource ? (
        <div className="space-y-6">
          {resource.overview ? (
            <article className="rounded-[28px] bg-surface px-6 py-6 shadow-card sm:px-10 sm:py-8">
              <h2 className="text-[22px] font-semibold tracking-tight text-ink">
                En bref&nbsp;<span className="align-middle">✨</span>
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{resource.overview}</p>
              {resource.keywords.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {resource.keywords.map((k) => (
                    <Badge key={k} tone="neutral">
                      {k}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </article>
          ) : null}

          {resource.outline.length ? (
            <section className="rounded-[28px] bg-surface px-6 py-6 shadow-card sm:px-10 sm:py-8">
              <h2 className="text-[22px] font-semibold tracking-tight text-ink">
                Grandes lignes&nbsp;<span className="align-middle">🗺️</span>
              </h2>
              <ol className="mt-5 grid gap-4 md:grid-cols-2">
                {resource.outline.map((s, i) => (
                  <li key={i} className="rounded-[22px] bg-sky/60 p-5">
                    <p className="text-[12px] font-medium uppercase tracking-wider text-ink-2/70">Partie {i + 1}</p>
                    <p className="mt-1 text-[17px] font-semibold text-ink">{s.title}</p>
                    <ul className="mt-3 space-y-1.5 text-[14px] text-ink-2">
                      {s.points.map((p, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/50" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {resource.key_points.length ? (
            <section className="rounded-[28px] bg-surface px-6 py-6 shadow-card sm:px-10 sm:py-8">
              <h2 className="text-[22px] font-semibold tracking-tight text-ink">
                À retenir&nbsp;<span className="align-middle">📌</span>
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resource.key_points.map((k, i) => (
                  <div key={i} className={`rounded-[22px] p-5 ${["bg-lemon", "bg-pink", "bg-lavender", "bg-mint"][i % 4]}`}>
                    <Lightbulb className="h-5 w-5 text-ink/70" />
                    <p className="mt-2 text-[16px] font-semibold text-ink">{k.title}</p>
                    <p className="mt-1 text-[14px] leading-snug text-ink-2">{k.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <p className="text-center text-sm text-muted">
            {viewer ? "Copiez ce cours dans votre espace pour générer vos propres résumés, lectures audio, quiz et cartes mémoire." : "Créez votre espace gratuit pour copier ce cours et générer résumés, lectures audio, quiz et cartes mémoire."}
          </p>
        </div>
      ) : null}

      {share.type === "quiz" && "questions" in resource ? (
        <SharedQuiz token={share.token} questions={resource.questions} viewerName={viewer?.name ?? null} />
      ) : null}

      {share.type === "audio" && "file_path" in resource ? (
        <div className="rounded-[28px] bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setPlayerOpen(true)} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform hover:scale-105" aria-label="Écouter">
              <Play className="ml-1 h-7 w-7" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold text-ink">Écouter avec le lecteur synchronisé</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <Badge tone="neutral">{resource.voice_label ?? "Voix par défaut"}</Badge>
                {resource.duration_seconds ? <span>{formatDuration(resource.duration_seconds)}</span> : null}
                <span>· {SOURCE_LABEL[resource.source] ?? "Lecture du cours"} · sous-titres, sommaire et recherche</span>
              </p>
            </div>
          </div>
          <AudioPlayerDialog
            track={{
              id: resource.id,
              title: share.title,
              subtitle: `${resource.course.title} · ${resource.voice_label ?? "Voix par défaut"}`,
              src: audioPublicUrl(resource.file_path),
              transcriptUrl: transcriptPublicUrl(resource.file_path),
              domain: resource.course.domain,
              durationSeconds: resource.duration_seconds,
            }}
            open={playerOpen}
            onOpenChange={setPlayerOpen}
          />
        </div>
      ) : null}

      {share.type === "chat" && "messages" in resource ? (
        <div className="space-y-4 rounded-[28px] bg-surface p-7 shadow-card">
          {resource.messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white whitespace-pre-wrap">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <Markdown content={m.content} className="prose-sm min-w-0" />
              </div>
            ),
          )}
        </div>
      ) : null}

      {share.type === "chat" ? (
        <div className="flex flex-col gap-4 rounded-[28px] bg-mint/60 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-ink">
              <MessageSquarePlus className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-ink">Une question sur ce cours ?</p>
              <p className="mt-0.5 text-sm text-ink-2/80">Reprenez cette discussion dans votre espace : l’assistant connaît le cours et répond à vos propres questions.</p>
            </div>
          </div>
          {viewer ? (
            <Button onClick={continueChat} loading={continuing} className="shrink-0">
              <Sparkles className="h-4 w-4" /> Poser une question
            </Button>
          ) : (
            <Button asChild className="shrink-0">
              <Link href={`/signup?next=${encodeURIComponent(`/s/${share.token}`)}`}>
                <Sparkles className="h-4 w-4" /> Créer un compte pour poser une question
              </Link>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SharedQuiz({ token, questions, viewerName }: { token: string; questions: { question: string; options: string[] }[]; viewerName: string | null }) {
  const [guest, setGuest] = useState("");

  async function submit(answers: (number | null)[]): Promise<GradeResult> {
    return apiJson<GradeResult>(`/api/shares/${token}/grade`, { method: "POST", body: JSON.stringify({ answers, guestName: viewerName ?? (guest.trim() || undefined) }) });
  }

  return (
    <div className="space-y-4">
      {!viewerName ? (
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] bg-surface px-5 py-3 shadow-card sm:rounded-full">
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-muted">
            <UserRound className="h-4 w-4" /> Votre prénom (facultatif)
          </span>
          <input value={guest} onChange={(e) => setGuest(e.target.value)} className="min-w-[180px] flex-1 bg-transparent text-sm text-ink outline-none" placeholder="Pour que l’auteur sache qui a répondu" maxLength={60} />
        </label>
      ) : null}
      <QuizRunner questions={questions} onSubmit={submit} />
    </div>
  );
}
