"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog as D } from "radix-ui";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, X, Search, AlignLeft, ListTree, BookOpen, Loader2, GraduationCap, Repeat, Check, PartyPopper, ListRestart } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { DomainIcon } from "@/components/dashboard/domain-icon";
import { findWordIndex, type Transcript } from "@/lib/transcript";
import { notifyPosition, readPosition, savePosition, readLearnMode, saveLearnMode, readMastery, saveMastery } from "@/lib/offline";

export type PlayerTrack = {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  transcriptUrl: string | null;
  domain?: string;
  durationSeconds?: number | null;
  /** Position de départ en secondes (reprise, lien profond). */
  startAt?: number;
  defaultShowText?: boolean;
};

type FlatWord = { t: string; s: number; e: number; p: number; i: number };
type Sentence = { text: string; start: number; paragraph: number; firstWord: number; lastWord: number };
type Suggestion = { kind: "section" | "passage"; label: string; detail?: string; time: number };

const RATES = [0.8, 1, 1.25, 1.5];

export function AudioPlayerDialog({ track, open, onOpenChange }: { track: PlayerTrack | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <D.Content className="fixed inset-0 z-50 overflow-y-auto outline-none data-[state=open]:animate-fade-in" aria-describedby={undefined}>
          {track ? <Player key={track.id} track={track} onClose={() => onOpenChange(false)} /> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Player({ track, onClose }: { track: PlayerTrack; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [transcript, setTranscript] = useState<Transcript | null | "none">(() => (track.transcriptUrl ? null : "none"));
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(() => track.startAt || readPosition(track.id));
  const [duration, setDuration] = useState(track.durationSeconds ?? 0);
  const [rate, setRate] = useState(1);
  const [showText, setShowText] = useState(track.defaultShowText ?? true);
  const [follow, setFollow] = useState(true);
  const [buffering, setBuffering] = useState(true);

  // Mode Parcœuriser (apprentissage par cœur) : la partie courante tourne en boucle jusqu’à validation, puis on passe à la suivante non maîtrisée.
  const [learn, setLearn] = useState(() => readLearnMode());
  const [mastered, setMastered] = useState<number[]>(() => readMastery(track.id));
  const [loops, setLoops] = useState(0);
  const learnRef = useRef(learn);
  const sectionsRef = useRef<{ start: number }[]>([]);
  /** Partie à répéter : ne change que lors d’un déplacement explicite (sommaire, boutons, forme d’onde), jamais parce que la lecture a franchi sa fin. */
  const loopSectionRef = useRef(-1);

  const sectionAt = useCallback((t: number) => sectionsRef.current.reduce((acc, s, i) => (t + 0.05 >= s.start ? i : acc), -1), []);

  /** Retient comme partie à répéter celle qui contient la position donnée. Renvoie true si elle a changé. */
  const adoptLoopSection = useCallback(
    (t: number) => {
      const idx = sectionAt(t);
      const changed = idx !== loopSectionRef.current;
      loopSectionRef.current = idx;
      return changed;
    },
    [sectionAt],
  );

  /** Mode Parcœuriser : si la partie à répéter est terminée, on la reprend depuis son début. Renvoie true si un retour a eu lieu. */
  const checkLoop = useCallback((a: HTMLAudioElement) => {
    // Pas de retour pendant un déplacement en cours (sinon un saut vers la partie suivante serait annulé) ni à l’arrêt.
    if (!learnRef.current || a.seeking || a.paused) return false;
    const secs = sectionsRef.current;
    const idx = loopSectionRef.current;
    if (idx < 0 || idx >= secs.length) return false;
    const end = secs[idx + 1]?.start ?? a.duration;
    if (!Number.isFinite(end) || a.currentTime < end - 0.05) return false;
    a.currentTime = secs[idx].start;
    setLoops((n) => n + 1);
    return true;
  }, []);

  // Transcription synchronisée (absente pour les lectures générées avant cette fonctionnalité).
  useEffect(() => {
    if (!track.transcriptUrl) return;
    let cancelled = false;
    fetch(track.transcriptUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Transcript | null) => {
        if (!cancelled) setTranscript(data && data.version === 1 ? data : "none");
      })
      .catch(() => !cancelled && setTranscript("none"));
    return () => {
      cancelled = true;
    };
  }, [track.transcriptUrl]);

  const data = transcript && transcript !== "none" ? transcript : null;

  useEffect(() => {
    learnRef.current = learn;
    saveLearnMode(learn);
    if (learn) adoptLoopSection(audioRef.current?.currentTime ?? 0);
  }, [learn, adoptLoopSection]);
  useEffect(() => {
    sectionsRef.current = data?.sections ?? [];
    if (learnRef.current) adoptLoopSection(audioRef.current?.currentTime ?? 0);
  }, [data, adoptLoopSection]);

  const flat = useMemo<FlatWord[]>(() => {
    if (!data) return [];
    const out: FlatWord[] = [];
    data.paragraphs.forEach((p, pi) => p.words.forEach((w, wi) => out.push({ t: w[0], s: w[1], e: w[2], p: pi, i: wi })));
    return out;
  }, [data]);

  const sentences = useMemo<Sentence[]>(() => {
    const out: Sentence[] = [];
    let start = 0;
    for (let i = 0; i < flat.length; i++) {
      const w = flat[i];
      const endOfSentence = /[.!?…]["»)]?$/.test(w.t) || i === flat.length - 1 || flat[i + 1].p !== w.p;
      if (endOfSentence) {
        const words = flat.slice(start, i + 1);
        out.push({ text: words.map((x) => x.t).join(" "), start: words[0].s, paragraph: w.p, firstWord: start, lastWord: i });
        start = i + 1;
      }
    }
    return out;
  }, [flat]);

  const wordIndex = flat.length ? findWordIndex(flat, time + 0.05) : -1;
  const sentenceIndex = useMemo(() => (wordIndex < 0 ? -1 : sentences.findIndex((s) => wordIndex >= s.firstWord && wordIndex <= s.lastWord)), [sentences, wordIndex]);
  const sectionIndex = data ? data.sections.reduce((acc, s, i) => (time + 0.05 >= s.start ? i : acc), -1) : -1;

  // Boucle de lecture : suit le temps courant finement (surlignage des mots).
  useEffect(() => {
    if (!playing) return;
    const audioEl = audioRef.current;
    let raf = 0;
    let last = -1;
    let lastSave = 0;
    const tick = () => {
      const a = audioEl;
      if (a) {
        // Mode Parcœuriser (apprentissage par cœur) : retour au début de la partie à répéter dès qu’elle est terminée.
        if (checkLoop(a)) last = -1;
        const t = a.currentTime;
        if (Math.abs(t - last) >= 0.04) {
          last = t;
          setTime(t);
        }
        if (t - lastSave > 2) {
          lastSave = t;
          savePosition(track.id, t, a.duration);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (audioEl) {
        savePosition(track.id, audioEl.currentTime, audioEl.duration);
        notifyPosition();
      }
    };
  }, [playing, track.id, checkLoop]);

  const seek = useCallback((t: number, andPlay = false) => {
    const a = audioRef.current;
    if (!a) return;
    const target = Math.max(0, Math.min(t, a.duration || duration || t));
    // La partie à répéter suit immédiatement le déplacement (avant même l’événement « seeked »).
    if (adoptLoopSection(target)) setLoops(0);
    a.currentTime = target;
    setTime(target);
    if (andPlay) void a.play();
  }, [duration, adoptLoopSection]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  function prevSection() {
    if (!data?.sections.length) return seek(time - 15);
    const current = data.sections[sectionIndex];
    if (current && time - current.start > 3) return seek(current.start, true);
    const prev = data.sections[Math.max(0, sectionIndex - 1)];
    seek(prev ? prev.start : 0, true);
  }

  function nextSection() {
    if (!data?.sections.length) return seek(time + 15);
    const next = data.sections[sectionIndex + 1];
    if (next) seek(next.start, true);
  }

  // Parties maîtrisées (mode Parcœuriser)
  const masteredSet = useMemo(() => new Set(mastered), [mastered]);
  const sectionCount = data?.sections.length ?? 0;
  const masteredCount = data ? data.sections.filter((_, i) => masteredSet.has(i)).length : 0;
  const allMastered = sectionCount > 0 && masteredCount === sectionCount;
  const currentMastered = sectionIndex >= 0 && masteredSet.has(sectionIndex);

  /** Valide la partie courante puis passe à la prochaine partie non maîtrisée (ou s’arrête si tout est validé). */
  const markMastered = useCallback(() => {
    if (!data || sectionIndex < 0) return;
    const next = Array.from(new Set([...mastered, sectionIndex])).sort((a, b) => a - b);
    setMastered(next);
    saveMastery(track.id, next);
    const done = new Set(next);
    const after = data.sections.findIndex((_, i) => i > sectionIndex && !done.has(i));
    const anywhere = data.sections.findIndex((_, i) => !done.has(i));
    const go = after >= 0 ? after : anywhere;
    setLoops(0);
    if (go >= 0) seek(data.sections[go].start, true);
    else audioRef.current?.pause();
  }, [data, sectionIndex, mastered, track.id, seek]);

  function resetMastery() {
    setMastered([]);
    saveMastery(track.id, []);
    setLoops(0);
    if (data?.sections.length) seek(data.sections[0].start, true);
  }

  // Raccourcis clavier (espace : lecture/pause ; flèches : ±10 s ; M : partie maîtrisée) hors champs de saisie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") seek((audioRef.current?.currentTime ?? 0) + 10);
      else if (e.key === "ArrowLeft") seek((audioRef.current?.currentTime ?? 0) - 10);
      else if ((e.key === "m" || e.key === "M") && learnRef.current) markMastered();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, markMastered]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = rate;
  }, [rate]);

  const peaks = data?.peaks?.length ? data.peaks : pseudoPeaks(120);
  const hasToc = Boolean(data && data.sections.length > 1);
  const textShown = Boolean(showText && data);
  const gridColumns = textShown
    ? hasToc
      ? "xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1.15fr)]"
      : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
    : hasToc
      ? "lg:grid-cols-[360px_minmax(0,1.35fr)]"
      : "";
  // Ordre d’affichage : lecteur d’abord sur écran étroit ; sommaire, lecteur, texte côte à côte sur grand écran.
  const asideOrder = textShown ? "order-3 xl:order-1" : "order-2 lg:order-1";
  const playerOrder = textShown ? "order-1 xl:order-2" : "order-1 lg:order-2";
  const total = duration || data?.duration || 0;
  const progress = total ? Math.min(1, time / total) : 0;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0b1f2a] text-white">
      {/* Fond : halos pastel flous sur fond sombre */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-sky/30 blur-[120px]" />
        <div className="absolute right-[-10%] top-[20%] h-[480px] w-[480px] rounded-full bg-mint/25 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[30%] h-[520px] w-[520px] rounded-full bg-lavender/25 blur-[130px]" />
      </div>

      <audio
        ref={audioRef}
        src={track.src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(e) => {
          setPlaying(false);
          // Mode Parcœuriser (apprentissage par cœur) : la fin du fichier est aussi la fin de la partie à répéter, on la reprend.
          const secs = sectionsRef.current;
          const idx = learnRef.current ? loopSectionRef.current : -1;
          if (idx >= 0 && idx < secs.length) {
            e.currentTarget.currentTime = secs[idx].start;
            setLoops((n) => n + 1);
            void e.currentTarget.play();
          }
        }}
        onSeeked={(e) => {
          // Déplacement explicite (sommaire, boutons, forme d’onde, validation) : la partie à répéter devient celle visée.
          if (adoptLoopSection(e.currentTarget.currentTime)) setLoops(0);
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          const resume = track.startAt || readPosition(track.id);
          if (resume > 3 && resume < e.currentTarget.duration - 5) {
            e.currentTarget.currentTime = resume;
            adoptLoopSection(resume);
          }
        }}
        onTimeUpdate={(e) => {
          // Vérification également hors boucle d’animation (onglet en arrière-plan, où requestAnimationFrame est suspendu).
          if (checkLoop(e.currentTarget)) return;
          if (!playing) setTime(e.currentTarget.currentTime);
        }}
      />

      <div className={cn("relative mx-auto flex min-h-dvh w-full flex-col px-4 py-5 sm:px-6", showText && data ? "max-w-[1480px]" : "max-w-6xl")}>
        <div className="flex items-center justify-between">
          <D.Title className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-white/60">
            <BookOpen className="h-4 w-4" /> Lecture du cours
          </D.Title>
          <D.Close className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="Fermer le lecteur" onClick={onClose}>
            <X className="h-5 w-5" />
          </D.Close>
        </div>

        <div className={cn("mt-5 grid flex-1 content-start gap-5", gridColumns)}>
          {/* Carte lecteur */}
          <div className={cn("flex min-w-0 flex-col gap-5", playerOrder)}>
            <section className="rounded-[32px] border border-white/15 bg-white/10 p-6 shadow-pop backdrop-blur-2xl sm:p-8">
              <div className="flex items-start gap-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-mint via-sky to-lavender text-ink shadow-float sm:h-28 sm:w-28">
                  <DomainIcon domain={track.domain ?? ""} className="h-10 w-10" />
                </div>
                <div className="min-w-0 pt-1">
                  <h2 className="text-[26px] font-semibold leading-[1.1] tracking-tight sm:text-[34px] line-clamp-2">{track.title}</h2>
                  <p className="mt-2 text-[15px] text-white/70 line-clamp-2">{track.subtitle}</p>
                  {data && data.sections[sectionIndex] ? <p className="mt-2 truncate text-[13px] font-medium text-mint">{data.sections[sectionIndex].title}</p> : null}
                </div>
              </div>

              {/* Forme d’onde */}
              <div className="mt-8">
                <div className="flex items-center justify-between text-[14px] tabular-nums text-white/70">
                  <span>{formatDuration(time)}</span>
                  <span>{formatDuration(total)}</span>
                </div>
                <Waveform peaks={peaks} progress={progress} onSeek={(ratio) => seek(ratio * total)} />
              </div>

              {/* Sous-titre karaoké */}
              <div className="mt-6 min-h-[64px] rounded-[22px] bg-black/20 px-5 py-4 text-center text-[17px] leading-relaxed sm:text-[19px]">
                {transcript === null ? (
                  <span className="inline-flex items-center gap-2 text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement des sous-titres…
                  </span>
                ) : sentenceIndex >= 0 ? (
                  <>
                    {data?.paragraphs[sentences[sentenceIndex].paragraph]?.speaker ? (
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-mint">{data.paragraphs[sentences[sentenceIndex].paragraph].speaker}</span>
                    ) : null}
                    <Karaoke words={flat.slice(sentences[sentenceIndex].firstWord, sentences[sentenceIndex].lastWord + 1)} firstWordIndex={sentences[sentenceIndex].firstWord} activeIndex={wordIndex} onSeek={(t) => seek(t)} />
                  </>
                ) : data ? (
                  <span className="text-white/60">{playing ? "…" : "Appuyez sur lecture pour commencer."}</span>
                ) : (
                  <span className="text-white/60">Sous-titres indisponibles pour cette lecture (générée avant la mise à jour). Régénérez-la pour en profiter.</span>
                )}
              </div>

              {/* Commandes */}
              <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
                <GlassButton onClick={() => seek(time - 15)} label="Reculer de 15 secondes" small>
                  <RotateCcw className="h-5 w-5" />
                </GlassButton>
                <GlassButton onClick={prevSection} label="Partie précédente">
                  <SkipBack className="h-6 w-6" />
                </GlassButton>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Pause" : "Lecture"}
                  className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white text-ink shadow-pop transition-transform hover:scale-[1.04] active:scale-[0.98]"
                >
                  {buffering && playing ? <Loader2 className="h-7 w-7 animate-spin" /> : playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
                </button>
                <GlassButton onClick={nextSection} label="Partie suivante">
                  <SkipForward className="h-6 w-6" />
                </GlassButton>
                <GlassButton onClick={() => seek(time + 15)} label="Avancer de 15 secondes" small>
                  <RotateCw className="h-5 w-5" />
                </GlassButton>
              </div>

              {/* Mode Parcœuriser : validation de la partie courante */}
              {learn && data && sectionCount > 0 ? (
                <div className="mt-5 rounded-[22px] border border-mint/30 bg-mint/15 p-4">
                  {allMastered ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-[15px] font-medium">
                        <PartyPopper className="h-5 w-5 text-mint" /> Toutes les parties sont maîtrisées. Bravo !
                      </p>
                      <button type="button" onClick={resetMastery} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-[13px] font-semibold text-white hover:bg-white/25">
                        <ListRestart className="h-4 w-4" /> Recommencer
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-mint">
                          <Repeat className="h-4 w-4" /> Mode Parcœuriser
                          {loops > 0 ? <span className="rounded-full bg-mint/25 px-2 py-0.5 normal-case tracking-normal text-white">{loops + 1}ᵉ écoute</span> : null}
                        </p>
                        <p className="mt-1 text-[14px] text-white/75">
                          {sectionIndex < 0
                            ? "Lancez la lecture : chaque partie se répète jusqu’à ce que vous la validiez."
                            : currentMastered
                              ? "Partie déjà maîtrisée : elle se répète tant que vous ne passez pas à la suivante."
                              : `« ${data.sections[sectionIndex].title} » se répète jusqu’à ce que vous la validiez.`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={markMastered}
                        disabled={sectionIndex < 0}
                        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-mint px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-white disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> {currentMastered ? "Partie suivante" : "Je maîtrise cette partie"}
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-[12px] text-white/50">
                    {masteredCount} / {sectionCount} partie{sectionCount > 1 ? "s" : ""} maîtrisée{masteredCount > 1 ? "s" : ""} · touche M pour valider
                  </p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
                  className="h-10 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] font-semibold tabular-nums text-white hover:bg-white/20"
                  aria-label="Vitesse de lecture"
                >
                  {rate.toString().replace(".", ",")}×
                </button>
                {data ? (
                  <button
                    type="button"
                    onClick={() => setShowText((v) => !v)}
                    aria-pressed={showText}
                    className={cn("inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-[13px] font-semibold transition-colors", showText ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20")}
                  >
                    <AlignLeft className="h-4 w-4" /> {showText ? "Masquer le texte" : "Afficher tout le texte"}
                  </button>
                ) : null}
                {data && sectionCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLearn((v) => !v);
                      setLoops(0);
                    }}
                    aria-pressed={learn}
                    title="Chaque partie se répète jusqu’à ce que vous la validiez comme maîtrisée"
                    className={cn("inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-[13px] font-semibold transition-colors", learn ? "bg-mint text-ink" : "bg-white/10 text-white hover:bg-white/20")}
                  >
                    <GraduationCap className="h-4 w-4" /> Mode Parcœuriser
                  </button>
                ) : null}
              </div>
            </section>

          </div>

          {/* Texte complet synchronisé : à droite du lecteur sur grand écran, sous le lecteur sinon */}
          {showText && data ? (
            <div className="order-2 min-w-0 xl:order-3 xl:sticky xl:top-5 xl:self-start">
              <TranscriptPanel data={data} wordIndex={wordIndex} flat={flat} follow={follow} onToggleFollow={() => setFollow((f) => !f)} onSeek={(t) => seek(t, true)} />
            </div>
          ) : null}

          {/* Sommaire + recherche : à gauche du lecteur sur grand écran */}
          {data && data.sections.length > 1 ? (
            <aside className={cn("min-w-0 rounded-[32px] border border-white/15 bg-white/10 p-5 shadow-pop backdrop-blur-2xl lg:sticky lg:top-5 lg:self-start", asideOrder)}>
              <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                <ListTree className="h-4 w-4" /> Sommaire
                {learn ? (
                  <span className="ml-auto inline-flex items-center gap-2 text-[12px] font-medium text-white/70">
                    <span className="tabular-nums">
                      {masteredCount}/{sectionCount} maîtrisées
                    </span>
                    {masteredCount > 0 ? (
                      <button type="button" onClick={resetMastery} className="rounded-full p-1 hover:bg-white/15" title="Réinitialiser les parties maîtrisées" aria-label="Réinitialiser les parties maîtrisées">
                        <ListRestart className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </h3>
              <SearchBox data={data} sentences={sentences} onPick={(t) => seek(t, true)} />
              <ol className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                {data.sections.map((s, i) => {
                  const active = i === sectionIndex;
                  const done = learn ? masteredSet.has(i) : i < sectionIndex;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => seek(s.start, true)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                          active ? "bg-white text-ink" : "text-white/85 hover:bg-white/10",
                        )}
                      >
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", active && !done ? "bg-ink text-white" : done ? "bg-mint text-ink" : "bg-white/15 text-white")}>
                          {learn && done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium leading-snug">{s.title}</span>
                          <span className={cn("flex items-center gap-1.5 text-[12px] tabular-nums", active ? "text-ink/60" : "text-white/50")}>
                            {formatDuration(s.start)}
                            {learn && active && !done ? (
                              <span className="inline-flex items-center gap-1">
                                · <Repeat className="h-3 w-3" /> en boucle
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GlassButton({ children, onClick, label, small }: { children: React.ReactNode; onClick: () => void; label: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("flex items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20", small ? "h-11 w-11" : "h-14 w-14")}
    >
      {children}
    </button>
  );
}

function pseudoPeaks(n: number) {
  return Array.from({ length: n }, (_, i) => 0.35 + 0.45 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)));
}

function Waveform({ peaks, progress, onSeek }: { peaks: number[]; progress: number; onSeek: (ratio: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const ratioFrom = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const step = 3;
  const width = peaks.length * step;
  const playedBars = Math.round(progress * peaks.length);
  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Position de lecture"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeek(ratioFrom(e.clientX));
      }}
      onPointerMove={(e) => dragging.current && onSeek(ratioFrom(e.clientX))}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.02));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.02));
      }}
      className="mt-2 h-16 w-full cursor-pointer touch-none"
    >
      {/* SVG étiré sur toute la largeur : lisible à toutes les tailles d’écran */}
      <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
        {peaks.map((p, i) => {
          const h = Math.max(8, p * 100);
          return <rect key={i} x={i * step + 0.5} y={(100 - h) / 2} width={step - 1} height={h} rx={1} fill={i < playedBars ? "#ffffff" : "rgba(255,255,255,0.35)"} />;
        })}
      </svg>
    </div>
  );
}

function Karaoke({ words, firstWordIndex, activeIndex, onSeek }: { words: FlatWord[]; firstWordIndex: number; activeIndex: number; onSeek: (t: number) => void }) {
  return (
    <p>
      {words.map((w, k) => {
        const gi = firstWordIndex + k;
        const state = gi === activeIndex ? "active" : gi < activeIndex ? "past" : "future";
        return (
          <span key={k} onClick={() => onSeek(w.s)} className={cn("cursor-pointer rounded px-0.5 transition-colors", state === "active" ? "bg-white text-ink" : state === "past" ? "text-white" : "text-white/55")}>
            {w.t}{" "}
          </span>
        );
      })}
    </p>
  );
}

function TranscriptPanel({ data, wordIndex, flat, follow, onToggleFollow, onSeek }: { data: Transcript; wordIndex: number; flat: FlatWord[]; follow: boolean; onToggleFollow: () => void; onSeek: (t: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeParagraph = wordIndex >= 0 ? flat[wordIndex].p : -1;

  useEffect(() => {
    if (!follow || activeParagraph < 0) return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-paragraph="${activeParagraph}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeParagraph, follow]);

  // Index global (liste plate) du premier mot de chaque paragraphe.
  const starts = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const p of data.paragraphs) {
      out.push(acc);
      acc += p.words.length;
    }
    return out;
  }, [data]);

  return (
    <section className="rounded-[32px] border border-white/15 bg-white/10 p-6 shadow-pop backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <AlignLeft className="h-4 w-4" /> Texte de la lecture
        </h3>
        <button type="button" onClick={onToggleFollow} aria-pressed={follow} className={cn("h-9 rounded-full px-3 text-[12px] font-semibold", follow ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20")}>
          {follow ? "Suivi activé" : "Suivre la lecture"}
        </button>
      </div>
      <div ref={containerRef} className="max-h-[52vh] space-y-4 overflow-y-auto pr-2 text-[16px] leading-relaxed scrollbar-thin xl:max-h-[calc(100dvh-12rem)]">
        {data.paragraphs.map((p, pi) => {
          const start = starts[pi];
          const section = p.heading ? data.sections[p.section] : null;
          return (
            <div key={pi} data-paragraph={pi} className={cn("rounded-2xl px-3 py-2 transition-colors", pi === activeParagraph ? "bg-white/10" : "")}>
              {section && p.heading ? <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-mint">{section.title}</p> : null}
              {p.speaker ? <span className="mr-2 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">{p.speaker}</span> : null}
              <p className={p.speaker ? "inline" : undefined}>
                {p.words.map((w, wi) => {
                  const gi = start + wi;
                  const state = gi === wordIndex ? "active" : gi < wordIndex ? "past" : "future";
                  return (
                    <span
                      key={wi}
                      onClick={() => onSeek(w[1])}
                      className={cn("cursor-pointer rounded px-0.5", state === "active" ? "bg-white text-ink" : state === "past" ? "text-white/90" : "text-white/55")}
                    >
                      {w[0]}{" "}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SearchBox({ data, sentences, onPick }: { data: Transcript; sentences: Sentence[]; onPick: (t: number) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const out: Suggestion[] = [];
    data.sections.forEach((s) => {
      if (normalize(s.title).includes(q)) out.push({ kind: "section", label: s.title, detail: formatDuration(s.start), time: s.start });
    });
    for (const s of sentences) {
      if (out.length >= 8) break;
      const idx = normalize(s.text).indexOf(q);
      if (idx >= 0) out.push({ kind: "passage", label: snippet(s.text, idx, query.length), detail: `${data.sections[data.paragraphs[s.paragraph]?.section]?.title ?? ""} · ${formatDuration(s.start)}`, time: s.start });
    }
    return out.slice(0, 8);
  }, [query, data, sentences]);

  function pick(s: Suggestion) {
    onPick(Math.max(0, s.time - 0.15));
    setQuery(s.kind === "section" ? s.label : query);
    setOpen(false);
  }

  return (
    <div className="relative mt-4">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => (c + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => (c - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[cursor]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Rechercher une partie ou un passage…"
        aria-label="Rechercher dans la lecture"
        role="combobox"
        aria-controls="player-search-listbox"
        aria-expanded={open && suggestions.length > 0 ? true : false}
        aria-autocomplete="list"
        className="h-11 w-full rounded-full border border-white/15 bg-black/20 pl-11 pr-4 text-[14px] text-white outline-none placeholder:text-white/45 focus:border-white/40"
      />
      {open && suggestions.length ? (
        <ul id="player-search-listbox" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-2xl border border-white/15 bg-[#10303d]/95 p-1.5 shadow-pop backdrop-blur-xl">
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setCursor(i)}
                className={cn("flex w-full flex-col items-start rounded-xl px-3 py-2 text-left", i === cursor ? "bg-white text-ink" : "text-white hover:bg-white/10")}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  {s.kind === "section" ? <ListTree className="h-3.5 w-3.5" /> : <AlignLeft className="h-3.5 w-3.5" />}
                  <span className="line-clamp-1">{s.label}</span>
                </span>
                {s.detail ? <span className={cn("text-[11px]", i === cursor ? "text-ink/60" : "text-white/55")}>{s.detail}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function snippet(text: string, index: number, length: number) {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 50);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}
