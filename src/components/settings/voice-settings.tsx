"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Square, Upload, Trash2, Play, Plus, AudioLines } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatDuration } from "@/lib/utils";

const SAMPLE_TEXT =
  "Bonjour, je m’appelle … et j’utilise Janngude pour réviser mes cours. Cette application m’aide à comprendre l’essentiel, à m’entraîner avec des quiz et à écouter mes cours quand je suis en déplacement. Lire à voix haute, avec un rythme naturel, permet d’obtenir une voix fidèle.";

export type VoiceItem = { id: string; name: string; created_at: string };

export function VoiceSettings({ voices, max, configured }: { voices: VoiceItem[]; max: number; configured: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(voices.length === 0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobName, setBlobName] = useState("enregistrement.webm");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState(voices.length ? `Ma voix ${voices.length + 1}` : "Ma voix");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectBlob(b: Blob | null, fileName = "enregistrement.webm") {
    setBlob(b);
    setBlobName(fileName);
    setPreviewUrl(b ? URL.createObjectURL(b) : null);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        selectBlob(new Blob(chunksRef.current, { type }), type.includes("mp4") ? "enregistrement.m4a" : "enregistrement.webm");
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= 180) stopRecording();
      }, 1000);
    } catch {
      toast.error("Impossible d’accéder au micro. Vérifiez les autorisations du navigateur.");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (20 Mo maximum).");
      return;
    }
    selectBlob(f, f.name);
  }

  async function save() {
    if (!blob) return;
    setSaving(true);
    try {
      // L’échantillon part directement dans le bucket privé « voices » (dossier de l’utilisateur) : les fonctions
      // serveur (Vercel) limitent le corps des requêtes à 4,5 Mo. La route ne reçoit ensuite que le chemin.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée, reconnectez-vous.");
      const ext = blobName.includes(".") ? blobName.slice(blobName.lastIndexOf(".")).toLowerCase() : ".webm";
      const samplePath = `${user.id}/${crypto.randomUUID()}${ext}`;
      const mime = blob.type || "audio/webm";
      const { error: uploadError } = await supabase.storage.from("voices").upload(samplePath, blob, { contentType: mime, upsert: false });
      if (uploadError) throw new Error(`Échec de l’envoi de l’échantillon (${uploadError.message}).`);
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Ma voix", samplePath, fileName: blobName, mime }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      toast.success("Voix ajoutée. Elle est disponible pour vos lectures.");
      selectBlob(null);
      setAdding(false);
      setName(`Ma voix ${voices.length + 2}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function remove(voice: VoiceItem) {
    if (!confirm(`Supprimer la voix « ${voice.name} » ? Les lectures déjà générées sont conservées.`)) return;
    setDeleting(voice.id);
    try {
      const res = await fetch(`/api/voices/${voice.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      toast.success("Voix supprimée.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(null);
    }
  }

  if (!configured) {
    return (
      <p className="rounded-2xl bg-lemon px-5 py-4 text-sm text-[#6b4d00]">
        La voix personnalisée nécessite une clé ElevenLabs (<code className="font-mono text-[12px]">NEXT_ILEVENLABS_KEY</code>) dans le fichier <code className="font-mono text-[12px]">.env</code>.
      </p>
    );
  }

  const full = voices.length >= max;

  return (
    <div className="space-y-6">
      {/* Bibliothèque de voix */}
      {voices.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {voices.map((v, i) => (
            <li key={v.id} className={cn("relative rounded-[22px] p-4", ["bg-mint", "bg-sky", "bg-lavender", "bg-lemon", "bg-pink"][i % 5])}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-ink">
                  <AudioLines className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{v.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-2/80">Ajoutée le {formatDate(v.created_at)}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(v)} loading={deleting === v.id} aria-label={`Supprimer la voix ${v.name}`} title="Supprimer" className="-mr-1 -mt-1 shrink-0 text-ink/60 hover:bg-white/60 hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-ink">
                <Mic className="h-3 w-3" /> Choisissable dans « Voix » lors d’une lecture
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {voices.length > max ? `${voices.length} voix enregistrées (limite : ${max}).` : `${voices.length} / ${max} voix enregistrée${voices.length > 1 ? "s" : ""}.`}
        </p>
        {!adding ? (
          <Button variant={full ? "outline" : "primary"} size="sm" onClick={() => !full && setAdding(true)} disabled={full} title={full ? "Supprimez une voix pour en ajouter une nouvelle" : undefined}>
            <Plus className="h-4 w-4" /> Ajouter une voix
          </Button>
        ) : null}
      </div>

      {/* Ajout d’une voix */}
      {adding && !full ? (
        <div className="rounded-[24px] bg-surface-2/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Nouvelle voix</p>
              <p className="mt-1 text-[13px] text-muted">Lisez le texte ci-dessous pendant 60 secondes environ, dans un endroit calme, ou importez un enregistrement existant (MP3, WAV, M4A, WebM).</p>
            </div>
            {voices.length ? (
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving || recording}>
                Annuler
              </Button>
            ) : null}
          </div>
          <blockquote className="mt-4 rounded-[20px] bg-lavender/70 px-5 py-4 text-[16px] leading-relaxed text-ink">{SAMPLE_TEXT}</blockquote>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!recording ? (
              <Button variant="secondary" onClick={startRecording} disabled={saving}>
                <Mic className="h-4 w-4" /> Enregistrer au micro
              </Button>
            ) : (
              <Button variant="danger" onClick={stopRecording}>
                <Square className="h-4 w-4" /> Arrêter · {formatDuration(elapsed)}
              </Button>
            )}
            <label className={cn("inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-5 text-sm font-medium text-ink hover:bg-surface-3", saving && "pointer-events-none opacity-50")}>
              <Upload className="h-4 w-4" /> Importer un fichier
              <input type="file" accept="audio/*,.m4a,.webm" className="sr-only" onChange={onFile} />
            </label>
            {recording ? (
              <Badge tone="danger">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Enregistrement
              </Badge>
            ) : null}
          </div>

          {blob && previewUrl ? (
            <div className="mt-5 space-y-4 rounded-[20px] bg-surface p-4">
              <div className="flex items-center gap-3">
                <Play className="h-4 w-4 text-muted" />
                <audio controls src={previewUrl} className="h-9 w-full" />
              </div>
              <Field label="Nom de la voix" htmlFor="voice_name" hint="Par exemple « Ma voix », « Voix calme », « Voix du soir ».">
                <Input id="voice_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </Field>
              <div className="flex gap-2">
                <Button onClick={save} loading={saving}>
                  Ajouter cette voix
                </Button>
                <Button variant="ghost" onClick={() => selectBlob(null)} disabled={saving}>
                  Recommencer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
