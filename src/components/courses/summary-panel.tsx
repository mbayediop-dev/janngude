"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Share2, Download, Headphones, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Segmented, EmptyState } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/share/share-dialog";
import { readNdjson, apiJson } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import type { SummaryRow, SummaryLength } from "@/lib/supabase/types";

const LENGTH_LABEL: Record<SummaryLength, string> = { short: "Court", medium: "Standard", long: "Détaillé" };

export function SummaryPanel({
  courseId,
  courseTitle,
  summaries,
  onChange,
  onListen,
}: {
  courseId: string;
  courseTitle: string;
  summaries: SummaryRow[];
  onChange: (list: SummaryRow[]) => void;
  onListen: (summaryId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(summaries[0]?.id ?? null);
  const [creating, setCreating] = useState(summaries.length === 0);
  const [length, setLength] = useState<SummaryLength>("medium");
  const [focus, setFocus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState("");

  const selected = summaries.find((s) => s.id === selectedId) ?? null;

  async function generate() {
    setGenerating(true);
    setDraft("");
    try {
      const res = await fetch(`/api/courses/${courseId}/summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length, focus: focus.trim() || undefined }),
      });
      const result: { created: SummaryRow | null } = { created: null };
      await readNdjson(res, (ev) => {
        if (ev.type === "delta") setDraft((d) => d + (ev.text as string));
        if (ev.type === "done") result.created = ev.summary as SummaryRow;
        if (ev.type === "error") throw new Error(ev.message as string);
      });
      const row = result.created;
      if (row) {
        onChange([row, ...summaries]);
        setSelectedId(row.id);
        setCreating(false);
        setFocus("");
        toast.success("Résumé prêt.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
      setDraft("");
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce résumé ?")) return;
    try {
      await apiJson(`/api/summaries/${id}`, { method: "DELETE" });
      const next = summaries.filter((s) => s.id !== id);
      onChange(next);
      setSelectedId(next[0]?.id ?? null);
      if (next.length === 0) setCreating(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Liste */}
      <aside className="space-y-2">
        <Button variant={creating ? "primary" : "outline"} className="w-full justify-start" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nouveau résumé
        </Button>
        {summaries.length > 0 ? (
          <ul className="space-y-1.5">
            {summaries.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(s.id);
                    setCreating(false);
                  }}
                  className={cn(
                    "w-full rounded-[18px] px-4 py-3 text-left transition-[background-color,box-shadow]",
                    !creating && selectedId === s.id ? "bg-surface shadow-card ring-2 ring-ink" : "bg-surface/60 hover:bg-surface",
                  )}
                >
                  <span className="block truncate text-sm font-medium text-ink">{LENGTH_LABEL[s.length]}</span>
                  <span className="block text-[12px] text-muted">{formatDate(s.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      {/* Contenu */}
      <div className="min-w-0">
        {creating ? (
          <div className="rounded-[28px] bg-surface p-7 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-ink" /> Résumer le cours
            </h2>
            <p className="mt-1 text-sm text-muted">Le résumé suit l’ordre du cours et conserve définitions, formules et exemples essentiels.</p>
            <div className="mt-5 space-y-4">
              <div>
                <Label>Longueur</Label>
                <Segmented
                  value={length}
                  onChange={setLength}
                  options={[
                    { value: "short", label: "Court" },
                    { value: "medium", label: "Standard" },
                    { value: "long", label: "Détaillé" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="focus">Consigne particulière (facultatif)</Label>
                <Input id="focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex. insister sur les définitions et les exceptions" maxLength={200} />
              </div>
              <Button onClick={generate} loading={generating} size="lg">
                {generating ? "Rédaction en cours…" : "Générer le résumé"}
              </Button>
            </div>
            {draft ? (
              <div className="mt-6 border-t border-line pt-6">
                <Markdown content={draft} />
                <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
              </div>
            ) : null}
          </div>
        ) : selected ? (
          <article className="rounded-[28px] bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink">{selected.title}</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  <Badge tone="neutral" className="mr-2">
                    {LENGTH_LABEL[selected.length]}
                  </Badge>
                  {formatDate(selected.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onListen(selected.id)}>
                  <Headphones className="h-4 w-4" /> Écouter
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/export/pdf?type=summary&id=${selected.id}`}>
                    <Download className="h-4 w-4" /> PDF
                  </a>
                </Button>
                <ShareDialog
                  type="summary"
                  id={selected.id}
                  title={`${courseTitle} — résumé`}
                  downloads={[{ label: "PDF", href: `/api/export/pdf?type=summary&id=${selected.id}` }]}
                  trigger={
                    <Button size="sm">
                      <Share2 className="h-4 w-4" /> Partager
                    </Button>
                  }
                />
                <Button variant="ghost" size="icon-sm" onClick={() => remove(selected.id)} aria-label="Supprimer le résumé">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </header>
            <div className="px-6 py-6 sm:px-8">
              <Markdown content={selected.content} />
            </div>
          </article>
        ) : (
          <EmptyState title="Aucun résumé" description="Générez un résumé à la longueur de votre choix." action={<Button onClick={() => setCreating(true)}>Nouveau résumé</Button>} />
        )}
      </div>
    </div>
  );
}
