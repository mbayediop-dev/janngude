import type { OutlineSection, KeyPoint } from "@/lib/supabase/types";

/** Les grandes lignes en Markdown (une section par partie du cours). */
export function outlineToMarkdown(outline: OutlineSection[] | null | undefined) {
  return (outline ?? [])
    .map((s, i) => `## ${i + 1}. ${s.title}\n\n${s.points.map((p) => `- ${p}`).join("\n")}`)
    .join("\n\n");
}

/** Les points à retenir en Markdown (une section par point). */
export function keyPointsToMarkdown(keyPoints: KeyPoint[] | null | undefined) {
  return (keyPoints ?? []).map((k) => `## ${k.title}\n\n${k.detail}`).join("\n\n");
}
