"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { OfflineButton } from "@/components/audio/offline-button";
import { positionsSnapshot, readPosition, subscribePositions } from "@/lib/offline";
import Link from "next/link";
import { toast } from "sonner";
import { Headphones, Download, Share2, Trash2, Play, Mic, Volume2, Captions, BookOpen, FileText, ListTree, Lightbulb, Radio, WifiOff, Sparkles, Languages, Gauge, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { VoicePreviewButton } from "@/components/settings/voice-preview-button";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/share/share-dialog";
import { apiJson, audioPublicUrl, readNdjson, transcriptPublicUrl } from "@/lib/client";
import { AudioPlayerDialog, type PlayerTrack } from "@/components/audio/audio-player";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import type { AudioReadingRow, SummaryRow, OutlineSection, KeyPoint } from "@/lib/supabase/types";
import { outlineToMarkdown, keyPointsToMarkdown } from "@/lib/compile";
import { podcastBudget } from "@/lib/podcast-budget";
import { Khadija } from "@/components/brand/khadija";

type Source = "course" | "summary" | "outline" | "keypoints" | "podcast";
type Language = "fr" | "en" | "wo";
type Mode = "natural" | "faithful";
type Pace = "slow" | "normal" | "fast";
type Stage = "narration" | "synthesis" | "encoding" | "upload";

const SOURCE_META: Record<Source, { label: string; icon: React.ComponentType<{ className?: string }>; bg: string }> = {
  course: { label: "Cours complet", icon: BookOpen, bg: "bg-sky" },
  summary: { label: "Résumé", icon: FileText, bg: "bg-lavender" },
  outline: { label: "Grandes lignes", icon: ListTree, bg: "bg-lemon" },
  keypoints: { label: "À retenir", icon: Lightbulb, bg: "bg-pink" },
  podcast: { label: "Podcast à deux voix", icon: Radio, bg: "bg-mint" },
};

const STAGE_LABEL: Record<Stage, string> = {
  narration: "Rédaction du script",
  synthesis: "Synthèse vocale",
  encoding: "Normalisation du volume et encodage MP3",
  upload: "Enregistrement de la lecture",
};

function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_>#|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function AudioPanel({
  courseId,
  courseTitle,
  courseDomain,
  courseText,
  outline,
  keyPoints,
  summaries,
  initialAudios,
  voices,
  tts,
  ttsMaxChars,
  preselectedSummaryId,
}: {
  courseId: string;
  courseTitle: string;
  courseDomain: string;
  courseText: string;
  outline: OutlineSection[];
  keyPoints: KeyPoint[];
  summaries: SummaryRow[];
  initialAudios: AudioReadingRow[];
  voices: { id: string; name: string }[];
  tts: boolean;
  ttsMaxChars: number;
  preselectedSummaryId: string | null;
}) {
  const [audios, setAudios] = useState(initialAudios);
  // Valeurs par défaut : un résumé (le plus récent) dès qu’il en existe un, voix par défaut, narration naturelle, rythme soutenu.
  const [source, setSource] = useState<Source>(preselectedSummaryId || summaries.length ? "summary" : "course");
  const [summaryId, setSummaryId] = useState<string>(preselectedSummaryId ?? summaries[0]?.id ?? "");
  // "default" ou l’identifiant d’une voix personnalisée.
  const [voiceChoice, setVoiceChoice] = useState<string>("default");
  const [mode, setMode] = useState<Mode>("natural");
  const [pace, setPace] = useState<Pace>("fast");
  const [language, setLanguage] = useState<Language>("fr");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; stage: Stage; detail?: string } | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  function openPlayer(a: AudioReadingRow) {
    setTrack({
      id: a.id,
      title: a.title,
      subtitle: `${courseTitle} · ${a.voice_label ?? "Voix par défaut"}`,
      src: audioPublicUrl(a.file_path),
      transcriptUrl: transcriptPublicUrl(a.file_path),
      domain: courseDomain,
      durationSeconds: a.duration_seconds,
      startAt: readPosition(a.id),
    });
    setPlayerOpen(true);
  }

  // Positions de lecture mémorisées (reprise là où on s’est arrêté).
  const ids = audios.map((a) => a.id);
  const positions = useSyncExternalStore(subscribePositions, () => positionsSnapshot(ids), () => "");
  const positionOf = (id: string) => {
    const m = new RegExp(`(?:^|\\|)${id}:(\\d+)`).exec(positions);
    return m ? Number(m[1]) : 0;
  };

  // Quand l’étudiant clique « Écouter » depuis un résumé, on présélectionne ce résumé.
  const [prevPreselected, setPrevPreselected] = useState(preselectedSummaryId);
  if (preselectedSummaryId !== prevPreselected) {
    setPrevPreselected(preselectedSummaryId);
    if (preselectedSummaryId) {
      setSource("summary");
      setSummaryId(preselectedSummaryId);
    }
  }

  const text = useMemo(() => {
    if (source === "summary") {
      const s = summaries.find((x) => x.id === summaryId);
      return s ? stripMarkdown(s.content) : "";
    }
    if (source === "outline") return stripMarkdown(outlineToMarkdown(outline));
    if (source === "keypoints") return stripMarkdown(keyPointsToMarkdown(keyPoints));
    return courseText;
    // « podcast » : le dialogue est écrit à partir du cours complet.
  }, [source, summaryId, summaries, courseText, outline, keyPoints]);

  // Le podcast est un dialogue borné par `podcastBudget` : la longueur du cours ne le bloque jamais.
  const budget = podcastBudget(courseText.length, ttsMaxChars);
  const tooLong = source !== "podcast" && text.length > ttsMaxChars;
  const minutes = source === "podcast" ? budget.minutes : Math.max(1, Math.round(text.length / 900));
  const estimate = (chars: number) => `≈ ${Math.max(1, Math.round(chars / 900))} min`;

  // Cartes « Que lire ? » : icône, pastel et indication de durée par source.
  const sourceOptions = useMemo(() => {
    const summary = summaries.find((x) => x.id === summaryId) ?? summaries[0];
    const outlineChars = stripMarkdown(outlineToMarkdown(outline)).length;
    const keyChars = stripMarkdown(keyPointsToMarkdown(keyPoints)).length;
    return [
      { value: "course" as Source, label: "Cours complet", icon: BookOpen, bg: "bg-sky", meta: estimate(courseText.length) },
      { value: "summary" as Source, label: "Un résumé", icon: FileText, bg: "bg-lavender", meta: summaries.length ? `${summaries.length} disponible${summaries.length > 1 ? "s" : ""} · ${estimate(stripMarkdown(summary?.content ?? "").length)}` : "Aucun résumé" },
      { value: "outline" as Source, label: "Grandes lignes", icon: ListTree, bg: "bg-lemon", meta: outline.length ? `${outline.length} partie${outline.length > 1 ? "s" : ""} · ${estimate(outlineChars)}` : "Indisponible" },
      { value: "keypoints" as Source, label: "À retenir", icon: Lightbulb, bg: "bg-pink", meta: keyPoints.length ? `${keyPoints.length} point${keyPoints.length > 1 ? "s" : ""} · ${estimate(keyChars)}` : "Indisponible" },
      { value: "podcast" as Source, label: "Podcast à deux voix", icon: Radio, bg: "bg-mint", meta: `Dialogue · ${estimate(budget.target)}` },
    ];
  }, [summaries, summaryId, outline, keyPoints, courseText.length, budget.target]);

  const voiceLabel = voiceChoice === "default" ? "Voix par défaut" : (voices.find((v) => v.id === voiceChoice)?.name ?? "Ma voix");
  const styleLabel = source === "podcast" ? "Podcast" : mode === "natural" ? "Narration naturelle" : "Lecture fidèle";
  const languageLabel = { fr: "Français", en: "English", wo: "Wolof" }[language];

  async function generate() {
    if (!text) return toast.error("Rien à lire : choisissez une source.");
    setGenerating(true);
    setProgress({ percent: 0, stage: mode === "natural" ? "narration" : "synthesis" });
    try {
      const res = await fetch(`/api/courses/${courseId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, summaryId: source === "summary" ? summaryId : undefined, voice: voiceChoice === "default" ? "default" : "custom", voiceId: voiceChoice === "default" ? undefined : voiceChoice, mode: source === "podcast" ? "natural" : mode, pace, language }),
      });
      const result: { row: AudioReadingRow | null } = { row: null };
      await readNdjson(res, (ev) => {
        if (ev.type === "progress") setProgress({ percent: ev.percent as number, stage: ev.stage as Stage, detail: ev.detail as string | undefined });
        if (ev.type === "done") result.row = ev.audio as AudioReadingRow;
        if (ev.type === "error") throw new Error(ev.message as string);
      });
      if (!result.row) throw new Error("La génération s’est interrompue avant la fin.");
      const row = result.row;
      setAudios((a) => [row, ...a]);
      toast.success("Lecture audio prête.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette lecture audio ?")) return;
    try {
      await apiJson(`/api/audio/${id}`, { method: "DELETE" });
      setAudios((a) => a.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Générateur */}
      <div className="min-w-0 space-y-4">
        <div className="relative rounded-[28px] bg-surface p-6 shadow-card sm:p-7">
          <div className="flex items-start gap-4">
            <Khadija pose="headphones" className="-my-2 h-20 w-20" />
            <div className="min-w-0">
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">Nouvelle lecture</h2>
              <p className="mt-0.5 text-sm text-muted">Un MP3 avec sous-titres synchronisés, à écouter partout et à partager.</p>
            </div>
          </div>

          {/* Que lire ? */}
          <div className="mt-6">
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted">Que lire ?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Contenu à lire">
              {sourceOptions.map((opt) => {
                const active = source === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSource(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-[20px] p-3.5 text-left transition-all",
                      opt.value === "podcast" && "col-span-2",
                      active ? "bg-ink text-white shadow-float" : "bg-surface-2 text-ink hover:bg-surface-3",
                    )}
                  >
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", active ? "bg-white/15 text-white" : `${opt.bg} text-ink`)}>
                      <opt.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] font-semibold leading-tight">{opt.label}</span>
                    <span className={cn("text-[12px] leading-snug", active ? "text-white/65" : "text-muted")}>{opt.meta}</span>
                  </button>
                );
              })}
            </div>
            {source === "summary" ? (
              summaries.length ? (
                <div className="mt-3">
                  <Label htmlFor="summary-select">Quel résumé ?</Label>
                  <Select id="summary-select" value={summaryId} onChange={(e) => setSummaryId(e.target.value)}>
                    {summaries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {formatDate(s.created_at)}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <p className="mt-3 rounded-2xl bg-lemon px-4 py-3 text-[13px] text-[#6b4d00]">Aucun résumé pour l’instant : générez-en un dans l’onglet Résumés, ou lisez les grandes lignes.</p>
              )
            ) : null}
            {source === "podcast" ? (
              <p className="mt-3 rounded-2xl bg-mint/60 px-4 py-3 text-[13px] text-primary-ink">
                Un dialogue écrit à partir du cours : l’enseignant (votre voix choisie) explique, l’étudiant (seconde voix) pose les questions.
                {budget.condensed ? " Le cours est long : le dialogue en condense l’essentiel, partie par partie." : ""}
              </p>
            ) : null}
          </div>

          {/* Réglages */}
          <div className="mt-6 divide-y divide-line rounded-[22px] border border-line">
            <SettingRow icon={<Mic className="h-4 w-4" />} bg="bg-lavender" label="Voix" hint={voices.length ? "La voix par défaut ou l’une des vôtres." : "Enregistrez votre voix pour écouter vos cours avec."}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Segmented
                  value={voiceChoice}
                  onChange={setVoiceChoice}
                  className="flex-wrap"
                  options={[
                    { value: "default", label: "Voix par défaut" },
                    ...voices.map((v) => ({
                      value: v.id,
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <Mic className="h-3.5 w-3.5" /> {v.name}
                        </span>
                      ),
                    })),
                  ]}
                />
                <VoicePreviewButton voiceId={voiceChoice === "default" ? "default" : voiceChoice} variant="outline" />
                <Link href="/app/settings" className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink" title="Ajouter une voix dans Paramètres">
                  <Plus className="h-3.5 w-3.5" /> {voices.length ? "Gérer" : "Ajouter ma voix"}
                </Link>
              </div>
            </SettingRow>

            {source !== "podcast" ? (
              <SettingRow icon={<Sparkles className="h-4 w-4" />} bg="bg-lemon" label="Style" hint={mode === "natural" ? "Réécrit pour l’oral : phrases courtes, transitions, pauses. Un peu plus long à générer." : "Lu tel quel, avec des pauses aux titres et entre les paragraphes."}>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  className="flex-wrap"
                  options={[
                    { value: "natural", label: "Narration naturelle" },
                    { value: "faithful", label: "Lecture fidèle" },
                  ]}
                />
              </SettingRow>
            ) : null}

            {source === "podcast" || mode === "natural" ? (
              <SettingRow icon={<Languages className="h-4 w-4" />} bg="bg-sky" label="Langue" hint={language === "fr" ? "La langue du cours." : "Le cours est traduit et raconté dans cette langue ; les termes techniques sont conservés et expliqués."}>
                <Segmented
                  value={language}
                  onChange={setLanguage}
                  className="flex-wrap"
                  options={[
                    { value: "fr", label: "Français" },
                    { value: "en", label: "English" },
                    { value: "wo", label: "Wolof" },
                  ]}
                />
              </SettingRow>
            ) : null}

            <SettingRow icon={<Gauge className="h-4 w-4" />} bg="bg-pink" label="Rythme" hint={pace === "slow" ? "Lent et articulé, pour les notions difficiles." : pace === "normal" ? "Le débit d’une conversation." : "Un peu plus rapide, pour réviser efficacement."}>
              <Segmented
                value={pace}
                onChange={setPace}
                className="flex-wrap"
                options={[
                  { value: "slow", label: "Posé" },
                  { value: "normal", label: "Naturel" },
                  { value: "fast", label: "Soutenu" },
                ]}
              />
            </SettingRow>
          </div>

          {/* Lancement */}
          {tts ? (
            generating && progress ? (
              <div className="mt-5 rounded-[22px] bg-ink p-5 text-white" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-3 text-sm font-medium">
                    <Khadija pose={progress.stage === "narration" ? "study" : progress.stage === "synthesis" ? "microphone" : "headphones"} className="h-14 w-14" />
                    <span>
                      {STAGE_LABEL[progress.stage]}
                      {progress.detail ? <span className="text-white/60"> · morceau {progress.detail}</span> : null}
                    </span>
                  </p>
                  <span className="text-[24px] font-semibold tabular-nums">{progress.percent} %</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-mint transition-[width] duration-500" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-white/60">Vous pouvez changer d’onglet : la génération continue et la lecture apparaîtra à droite.</p>
              </div>
            ) : (
              <div className={cn("mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] p-2 pl-5", tooLong ? "bg-danger-soft" : "bg-ink text-white")}>
                <div className="min-w-0 py-2">
                  {tooLong ? (
                    <>
                      <p className="text-[15px] font-semibold text-danger">Texte trop long pour une lecture</p>
                      <p className="text-[12px] text-danger/80">
                        {text.length.toLocaleString("fr-FR")} caractères, limite {ttsMaxChars.toLocaleString("fr-FR")} : choisissez un résumé ou les grandes lignes.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[15px] font-semibold">≈ {minutes} min d’écoute</p>
                      <p className="truncate text-[12px] text-white/60">
                        {source === "podcast" ? `Dialogue ≈ ${budget.target.toLocaleString("fr-FR")} caractères, écrit à partir du cours (${courseText.length.toLocaleString("fr-FR")})` : `${text.length.toLocaleString("fr-FR")} caractères`} · {voiceLabel} · {styleLabel}
                        {source === "podcast" || mode === "natural" ? ` · ${languageLabel}` : ""}
                      </p>
                    </>
                  )}
                </div>
                <Button variant="white" size="lg" onClick={generate} disabled={!text || tooLong}>
                  <Headphones className="h-4 w-4" /> Générer le MP3
                </Button>
              </div>
            )
          ) : (
            <p className="mt-5 rounded-2xl bg-lemon px-4 py-3 text-[13px] text-[#6b4d00]">La génération MP3 nécessite une clé ElevenLabs dans le fichier .env.</p>
          )}
        </div>
      </div>

      <AudioPlayerDialog track={track} open={playerOpen} onOpenChange={setPlayerOpen} />

      {/* Bibliothèque audio */}
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink">
            Mes lectures
            {audios.length ? <span className="rounded-full bg-surface px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 shadow-card">{audios.length}</span> : null}
          </h2>
          <a href="/offline.html" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink shadow-card hover:bg-surface-2">
            <WifiOff className="h-3.5 w-3.5" /> Écoute hors ligne
          </a>
        </div>
        {audios.length === 0 ? (
          <div className="rounded-[28px] bg-surface p-7 shadow-card">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink">
              <Volume2 className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-ink">
              Votre première lecture apparaîtra ici&nbsp;<span className="align-middle">🎧</span>
            </h3>
            <p className="mt-1.5 text-sm text-muted">Choisissez quoi lire à gauche, puis « Générer le MP3 ». La génération prend une à deux minutes.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Captions, bg: "bg-sky", title: "Sous-titres synchronisés", text: "Texte surligné mot à mot, sommaire et recherche dans le lecteur." },
                { icon: WifiOff, bg: "bg-lavender", title: "Écoute hors ligne", text: "Téléchargez la lecture sur votre téléphone pour réviser sans connexion." },
                { icon: Share2, bg: "bg-lemon", title: "Partage en un clic", text: "Lien, WhatsApp ou MP3, vers vos camarades ou votre groupe." },
              ].map((f) => (
                <li key={f.title} className="rounded-[20px] bg-surface-2 p-4">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-ink", f.bg)}>
                    <f.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-[14px] font-semibold text-ink">{f.title}</p>
                  <p className="mt-1 text-[12px] leading-snug text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="space-y-3">
            {audios.map((a) => {
              const url = audioPublicUrl(a.file_path);
              const meta = SOURCE_META[a.source] ?? SOURCE_META.course;
              const position = positionOf(a.id);
              const progress = position > 0 && a.duration_seconds ? Math.min(100, Math.round((position / a.duration_seconds) * 100)) : 0;
              const voiceName = a.voice_label ?? (a.voice_kind === "custom" ? "Ma voix" : "Voix par défaut");
              return (
                <li key={a.id} className="rounded-[24px] bg-surface p-4 shadow-card sm:p-5">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => openPlayer(a)}
                      className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] transition-transform hover:scale-[1.04] active:scale-95", meta.bg)}
                      aria-label={`Écouter : ${a.title}`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white shadow-card">
                        <Play className="ml-0.5 h-4 w-4" />
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                      </p>
                      <p className="mt-1 truncate text-[15px] font-semibold text-ink">{a.title}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                        <Badge tone={a.voice_kind === "custom" ? "lemon" : "neutral"}>
                          {a.voice_kind === "custom" ? <Mic className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />} {voiceName}
                        </Badge>
                        {a.duration_seconds ? <span className="tabular-nums">{formatDuration(a.duration_seconds)}</span> : null}
                        <span>· {formatDate(a.created_at)}</span>
                        <span className="inline-flex items-center gap-1">
                          <Captions className="h-3.5 w-3.5" /> sous-titres
                        </span>
                      </p>
                      {progress > 0 ? (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                            <div className="h-full rounded-full bg-ink" style={{ width: `${progress}%` }} />
                          </div>
                          <button type="button" onClick={() => openPlayer(a)} className="shrink-0 text-[12px] font-medium text-ink hover:underline">
                            Reprendre à {formatDuration(position)}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:pl-20">
                    <OfflineButton track={{ id: a.id, title: a.title, subtitle: `${courseTitle} · ${voiceName}`, src: url, transcriptUrl: transcriptPublicUrl(a.file_path), domain: courseDomain, durationSeconds: a.duration_seconds }} />
                    <Button asChild variant="outline" size="sm">
                      <a href={url} download={`${a.title}.mp3`}>
                        <Download className="h-4 w-4" /> MP3
                      </a>
                    </Button>
                    <ShareDialog
                      type="audio"
                      id={a.id}
                      title={a.title}
                      downloads={[{ label: "MP3", href: url, fileName: `${a.title}.mp3` }]}
                      trigger={
                        <Button size="sm">
                          <Share2 className="h-4 w-4" /> Partager
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(a.id)} aria-label="Supprimer" className="ml-auto text-muted hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Ligne de réglage : icône pastel, libellé et aide à gauche, contrôle à droite. */
function SettingRow({ icon, bg, label, hint, children }: { icon: React.ReactNode; bg: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3 md:max-w-[46%]">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink", bg)}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{label}</p>
          {hint ? <p className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="min-w-0 md:shrink-0">{children}</div>
    </div>
  );
}
