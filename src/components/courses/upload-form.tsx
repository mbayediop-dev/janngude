"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, FileText, X, ArrowRight, Clapperboard, Mic, Square, Files, Music } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DOMAINS, subjectsFor } from "@/lib/domains";
import { cn, formatBytes, formatDuration, slugify } from "@/lib/utils";
import { apiJson } from "@/lib/client";
import { useRecorder, recordingFileName } from "@/lib/use-recorder";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.webm,.ogg,.mp4";
const MAX_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;

type Mode = "files" | "youtube" | "audio";

function mimeOf(file: File) {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
  };
  return map[ext] ?? "application/octet-stream";
}

function isAudio(file: File) {
  const m = mimeOf(file);
  return m.startsWith("audio/") || m === "video/mp4";
}

export function UploadForm({ knownDomains, knownSubjects }: { knownDomains: string[]; knownSubjects: Record<string, string[]> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("files");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const recorder = useRecorder(2 * 60 * 60);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const domainOptions = useMemo(() => {
    const set = new Set<string>([...knownDomains, ...DOMAINS.map((d) => d.name).filter((n) => n !== "Autre")]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [knownDomains]);

  const effectiveDomain = domain === "__custom" ? customDomain.trim() : domain;
  const subjectOptions = useMemo(() => {
    const set = new Set<string>([...(knownSubjects[effectiveDomain] ?? []), ...subjectsFor(effectiveDomain)]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [effectiveDomain, knownSubjects]);
  const effectiveSubject = subject === "__custom" || subjectOptions.length === 0 ? customSubject.trim() : subject;

  function addFiles(list: FileList | File[] | null | undefined) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!ACCEPT.split(",").includes(ext)) {
        toast.error(`${f.name} : format non pris en charge.`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} : fichier trop volumineux (50 Mo maximum).`);
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      if (next.length >= MAX_FILES) {
        toast.error(`${MAX_FILES} fichiers maximum par dépôt.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function checkClassification() {
    if (!effectiveDomain) {
      toast.error("Choisissez une formation.");
      return false;
    }
    if (!effectiveSubject) {
      toast.error("Indiquez la matière.");
      return false;
    }
    return true;
  }

  /** Envoie un fichier dans le stockage et crée le cours ; renvoie l’identifiant. */
  async function createCourseFromFile(file: File, userId: string, givenTitle: string) {
    const courseId = crypto.randomUUID();
    const ext = file.name.slice(file.name.lastIndexOf("."));
    const base = slugify(file.name.slice(0, file.name.lastIndexOf("."))) || "cours";
    const path = `${userId}/${courseId}/${base}${ext.toLowerCase()}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("courses").upload(path, file, { contentType: mimeOf(file), upsert: false });
    if (uploadError) {
      if (/bucket not found/i.test(uploadError.message)) throw new Error("Le stockage Supabase n’est pas initialisé (bucket « courses » introuvable). Exécutez les scripts de supabase/migrations.");
      throw new Error(`${file.name} : échec de l’envoi (${uploadError.message}).`);
    }
    const { error: insertError } = await supabase.from("courses").insert({
      id: courseId,
      user_id: userId,
      title: givenTitle || file.name.replace(/\.[^.]+$/, ""),
      domain: effectiveDomain,
      subject: effectiveSubject,
      file_path: path,
      file_name: file.name,
      file_type: mimeOf(file),
      file_size: file.size,
      status: "uploaded",
    });
    if (insertError) {
      if (insertError.code === "PGRST205") throw new Error("La base de données n’est pas initialisée (table « courses » introuvable). Exécutez les scripts de supabase/migrations.");
      throw new Error(`${file.name} : impossible d’enregistrer le cours (${insertError.message}).`);
    }
    return courseId;
  }

  async function submitFiles(list: File[]) {
    if (!list.length) return toast.error("Ajoutez au moins un fichier.");
    if (!checkClassification()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée, reconnectez-vous.");

      if (list.length === 1) {
        setProgress("Envoi du fichier…");
        const autoTitle = !title.trim();
        const id = await createCourseFromFile(list[0], user.id, title.trim());
        router.push(`/app/courses/${id}${autoTitle ? "?auto_title=1" : ""}`);
        return;
      }

      // Plusieurs fichiers : un cours par fichier, analyses lancées en arrière-plan.
      const ids: string[] = [];
      for (let i = 0; i < list.length; i++) {
        setProgress(`Envoi ${i + 1} / ${list.length} : ${list[i].name}`);
        ids.push(await createCourseFromFile(list[i], user.id, ""));
      }
      setProgress("Lancement des analyses…");
      for (const id of ids) {
        void fetch(`/api/courses/${id}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoTitle: true }), keepalive: true }).catch(() => {});
      }
      toast.success(`${ids.length} cours déposés. Les analyses se poursuivent en arrière-plan.`);
      router.push("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function submitYoutube() {
    if (!youtubeUrl.trim()) return toast.error("Collez le lien de la vidéo.");
    if (!checkClassification()) return;
    setSubmitting(true);
    setProgress("Récupération des sous-titres…");
    try {
      const { id, title: finalTitle } = await apiJson<{ id: string; title: string }>("/api/courses/import-youtube", {
        method: "POST",
        body: JSON.stringify({ url: youtubeUrl.trim(), domain: effectiveDomain, subject: effectiveSubject, title: title.trim() || undefined }),
      });
      router.push(`/app/courses/${id}${finalTitle.startsWith("Vidéo YouTube") ? "?auto_title=1" : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function stopRecording() {
    const blob = await recorder.stop();
    if (blob && blob.size > 50 * 1024) setRecordingBlob(blob);
    else toast.error("Enregistrement trop court.");
  }

  function submitRecording() {
    if (!recordingBlob) return;
    const file = new File([recordingBlob], recordingFileName(recordingBlob), { type: recordingBlob.type || "audio/webm" });
    void submitFiles([file]);
  }

  const canSubmit = mode === "files" ? files.length > 0 : mode === "youtube" ? youtubeUrl.trim().length > 0 : Boolean(recordingBlob);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "files", label: <span className="inline-flex items-center gap-1.5"><Files className="h-4 w-4" /> Fichiers</span> },
            { value: "youtube", label: <span className="inline-flex items-center gap-1.5"><Clapperboard className="h-4 w-4" /> Vidéo YouTube</span> },
            { value: "audio", label: <span className="inline-flex items-center gap-1.5"><Mic className="h-4 w-4" /> Note audio</span> },
          ]}
        />

        {mode === "files" ? (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-ink bg-mint/60" : "border-line-strong bg-surface hover:border-ink/50 hover:bg-mint/30",
              )}
            >
              <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink">
                <UploadCloud className="h-7 w-7" />
              </span>
              <p className="text-[15px] font-medium text-ink">Glissez un ou plusieurs cours ici</p>
              <p className="mt-1 text-sm text-muted">ou cliquez pour choisir des fichiers</p>
              <p className="mt-4 text-[12px] text-muted">PDF, Word, PowerPoint, texte, photo de notes, audio (MP3, M4A, WAV) · 50 Mo max · {MAX_FILES} fichiers par dépôt</p>
            </div>
            {files.length ? (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.name + f.size} className="flex items-center gap-3 rounded-[20px] bg-surface-2 p-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-ink">{isAudio(f) ? <Music className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                      <span className="block text-[12px] text-muted">{formatBytes(f.size)}{isAudio(f) ? " · transcription automatique" : ""}</span>
                    </span>
                    <button type="button" onClick={() => setFiles((l) => l.filter((x) => x !== f))} className="rounded-full p-1.5 text-muted hover:bg-surface-3 hover:text-ink" aria-label="Retirer le fichier">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[13px] text-muted">Les PDF scannés, les photos et les enregistrements audio sont transcrits automatiquement. Avec plusieurs fichiers, chaque fichier devient un cours.</p>
          </>
        ) : null}

        {mode === "youtube" ? (
          <div className="rounded-[28px] bg-surface p-7 shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink text-ink">
              <Clapperboard className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-[18px] font-semibold text-ink">Depuis une vidéo YouTube</h3>
            <p className="mt-1 text-sm text-muted">Collez le lien d’un cours filmé : ses sous-titres (automatiques ou non) deviennent le texte du cours, avec le minutage.</p>
            <div className="mt-4">
              <Field label="Lien de la vidéo" htmlFor="yt">
                <Input id="yt" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
              </Field>
            </div>
          </div>
        ) : null}

        {mode === "audio" ? (
          <div className="rounded-[28px] bg-surface p-7 shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender text-ink">
              <Mic className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-[18px] font-semibold text-ink">Note audio de cours</h3>
            <p className="mt-1 text-sm text-muted">Enregistrez le cours en amphi (jusqu’à deux heures) ; il sera transcrit puis analysé comme un document. Vous pouvez aussi importer un fichier audio dans l’onglet Fichiers.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!recorder.recording ? (
                <Button variant="secondary" onClick={recorder.start} disabled={submitting}>
                  <Mic className="h-4 w-4" /> {recordingBlob ? "Recommencer" : "Démarrer l’enregistrement"}
                </Button>
              ) : (
                <Button variant="danger" onClick={stopRecording}>
                  <Square className="h-4 w-4" /> Arrêter · {formatDuration(recorder.elapsed)}
                </Button>
              )}
              {recorder.recording ? <span className="inline-flex items-center gap-2 text-sm text-danger"><span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Enregistrement en cours</span> : null}
            </div>
            {recorder.error ? <p className="mt-3 text-sm text-danger">{recorder.error}</p> : null}
            {recordingBlob && !recorder.recording ? (
              <div className="mt-4 rounded-[20px] bg-surface-2 p-4">
                <p className="text-sm font-medium text-ink">Enregistrement prêt · {formatBytes(recordingBlob.size)}</p>
                <audio controls src={URL.createObjectURL(recordingBlob)} className="mt-2 h-9 w-full" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Classement */}
      <div className="space-y-5 rounded-[28px] bg-surface p-7 shadow-card">
        <div>
          <h2 className="text-base font-semibold text-ink">Classement</h2>
          <p className="mt-0.5 text-[13px] text-muted">Pour retrouver le cours dans votre espace.</p>
        </div>

        <Field label="Formation" htmlFor="domain">
          <Select id="domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="" disabled>
              Choisir une formation…
            </option>
            {domainOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value="__custom">Autre (saisir)…</option>
          </Select>
        </Field>
        {domain === "__custom" ? <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="Nom de la formation" aria-label="Nom de la formation" /> : null}

        <Field label="Matière" htmlFor="subject">
          {subjectOptions.length > 0 ? (
            <Select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!effectiveDomain}>
              <option value="" disabled>
                Choisir une matière…
              </option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__custom">Autre (saisir)…</option>
            </Select>
          ) : (
            <Input id="subject" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Ex. Droit des obligations" disabled={!effectiveDomain} />
          )}
        </Field>
        {subject === "__custom" && subjectOptions.length > 0 ? <Input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Nom de la matière" aria-label="Nom de la matière" /> : null}

        {mode !== "files" || files.length <= 1 ? (
          <Field label="Titre du cours" htmlFor="title" hint="Facultatif : détecté automatiquement à partir du contenu.">
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Chapitre 3 — La responsabilité civile" maxLength={140} />
          </Field>
        ) : (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-muted">Avec plusieurs fichiers, le titre de chaque cours est détecté automatiquement.</p>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={() => (mode === "files" ? submitFiles(files) : mode === "youtube" ? submitYoutube() : submitRecording())}
          loading={submitting}
          disabled={!canSubmit}
        >
          {progress ?? (mode === "files" && files.length > 1 ? `Analyser ${files.length} cours` : "Analyser le cours")}
          {!progress ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </div>
    </div>
  );
}
