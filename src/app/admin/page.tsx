import { Suspense } from "react";
import type { Metadata } from "next";
import { Users, BookOpen, FileText, ListChecks, Headphones, MessagesSquare, UsersRound, Sparkles } from "lucide-react";
import { PageHeader, Progress, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { UsersTable } from "@/components/admin/users-table";
import { Khadija } from "@/components/brand/khadija";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/admin";
import { elevenSubscription, ttsConfigured } from "@/lib/tts";
import { formatDate } from "@/lib/utils";
import type { AdminOverview, AdminUser } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Administration" };

const USAGE_LABEL: Record<string, string> = {
  ai_analysis_chars: "Analyse de cours (caractères IA)",
  ai_summary_chars: "Résumés (caractères IA)",
  ai_quiz_chars: "Quiz (caractères IA)",
  ai_chat_chars: "Assistant (caractères IA)",
  ai_flashcards_chars: "Cartes mémoire (caractères IA)",
  ai_exam_chars: "Examens blancs (caractères IA)",
  ai_narration_chars: "Narration et podcasts (caractères IA)",
  ai_ocr_bytes: "Transcription d’images et PDF scannés (octets)",
  stt_bytes: "Transcription audio (octets)",
  tts_chars: "Synthèse vocale ElevenLabs (caractères)",
  import_youtube: "Imports YouTube",
  course_copied: "Cours copiés depuis un partage",
};

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <PageHeader
        title="Administration"
        emoji="🛡️"
        description="Vue d’ensemble de la plateforme, consommation des services IA et gestion des comptes."
        eyebrow={<Badge tone="lemon">Réservé aux administrateurs</Badge>}
        actions={<Khadija pose="admin" className="h-28 w-28 sm:-my-4" />}
      />
      <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-[28px]" />}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AdminContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supabase = await createClient();
  const [{ data: overviewData }, { data: users }, eleven] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_users", { p_query: q || null, p_limit: 200 }),
    ttsConfigured() ? elevenSubscription().catch(() => null) : Promise.resolve(null),
  ]);
  const elevenPercent = eleven && eleven.limit ? Math.min(100, Math.round((eleven.used / eleven.limit) * 100)) : 0;
  const overview = (overviewData ?? {}) as Partial<AdminOverview>;
  const usage = overview.usage ?? {};
  const usage30 = overview.usage_30d ?? {};
  const kinds = Array.from(new Set([...Object.keys(usage), ...Object.keys(usage30)])).sort();

  const tiles = [
    { label: "Étudiants", value: overview.users ?? 0, hint: `${overview.users_7d ?? 0} cette semaine`, icon: Users, bg: "bg-mint" },
    { label: "Cours", value: overview.courses ?? 0, icon: BookOpen, bg: "bg-sky" },
    { label: "Résumés", value: overview.summaries ?? 0, icon: FileText, bg: "bg-lavender" },
    { label: "Quiz", value: overview.quizzes ?? 0, icon: ListChecks, bg: "bg-lemon" },
    { label: "Lectures audio", value: overview.audios ?? 0, icon: Headphones, bg: "bg-pink" },
    { label: "Discussions", value: overview.chats ?? 0, icon: MessagesSquare, bg: "bg-violet" },
    { label: "Groupes", value: overview.groups ?? 0, icon: UsersRound, bg: "bg-surface" },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-[24px] p-4 ${t.bg} ${t.bg === "bg-surface" ? "shadow-card" : ""}`}>
            <t.icon className="h-5 w-5 text-ink/70" />
            <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-ink">{t.value.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-[13px] text-ink-2/80">{t.label}</p>
            {"hint" in t && t.hint ? <p className="text-[12px] text-ink-2/60">{t.hint}</p> : null}
          </div>
        ))}
      </div>

      {eleven ? (
        <section className={`rounded-[28px] p-6 ${elevenPercent >= 90 ? "bg-pink" : "bg-surface shadow-card"}`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">
                Compte ElevenLabs (lecture audio)&nbsp;<span className="align-middle">🎙️</span>
              </h2>
              <p className="mt-1 text-sm text-ink-2/80">
                Forfait {eleven.tier || "—"} · {eleven.used.toLocaleString("fr-FR")} / {eleven.limit.toLocaleString("fr-FR")} caractères utilisés ce mois
                {eleven.resetAt ? ` · renouvellement le ${formatDate(eleven.resetAt)}` : ""} · voix {eleven.voicesUsed} / {eleven.voiceLimit}
              </p>
            </div>
            <span className="text-[28px] font-semibold tracking-tight text-ink">{elevenPercent} %</span>
          </div>
          <Progress value={elevenPercent} tone={elevenPercent >= 90 ? "danger" : "primary"} className="mt-4" />
          {elevenPercent >= 90 ? <p className="mt-3 text-sm text-ink">Le quota est presque épuisé : les lectures audio échoueront jusqu’au renouvellement, sauf achat de crédits ou changement de forfait sur elevenlabs.io.</p> : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[24px] font-semibold tracking-tight text-ink">
          <Sparkles className="h-5 w-5" /> Consommation des services
        </h2>
        {kinds.length === 0 ? (
          <p className="rounded-[22px] bg-surface p-5 text-sm text-muted shadow-card">Aucune consommation enregistrée pour l’instant.</p>
        ) : (
          <div className="rounded-[26px] bg-surface p-2 shadow-card">
            <div className="flex items-center justify-between px-4 py-2 text-[12px] font-medium uppercase tracking-wider text-muted">
              <span>Service</span>
              <span className="flex gap-6">
                <span className="w-24 text-right">30 jours</span>
                <span className="hidden w-24 text-right sm:inline">Total</span>
              </span>
            </div>
            <ul className="space-y-1">
              {kinds
                .slice()
                .sort((a, b) => (usage30[b] ?? 0) - (usage30[a] ?? 0))
                .map((k, i) => {
                  const month = usage30[k] ?? 0;
                  const total = usage[k] ?? 0;
                  const max = Math.max(1, ...kinds.map((x) => usage30[x] ?? 0));
                  const tone = k.startsWith("tts") ? "bg-pink" : k.startsWith("ai_") ? "bg-lavender" : k.startsWith("stt") ? "bg-sky" : "bg-mint";
                  return (
                    <li key={k} className={`rounded-[18px] px-4 py-3 ${i % 2 ? "" : "bg-surface-2/60"}`}>
                      <div className="flex items-center justify-between gap-4">
                        <p className="min-w-0 truncate text-[14px] font-medium text-ink">{USAGE_LABEL[k] ?? k}</p>
                        <p className="flex shrink-0 gap-6 text-[14px] tabular-nums">
                          <span className="w-24 text-right font-semibold text-ink">{month.toLocaleString("fr-FR")}</span>
                          <span className="hidden w-24 text-right text-muted sm:inline">{total.toLocaleString("fr-FR")}</span>
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, Math.round((month / max) * 100))}%` }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
            <p className="px-4 pb-2 pt-3 text-[12px] text-muted">Barres proportionnelles à la consommation des 30 derniers jours. Rose : synthèse vocale ElevenLabs · violet : Claude · bleu : transcription audio.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[24px] font-semibold tracking-tight text-ink">
          <Users className="h-5 w-5" /> Comptes
        </h2>
        <UsersTable users={(users ?? []) as AdminUser[]} query={q} selfId={admin.id} canDelete={adminConfigured()} />
      </section>
    </div>
  );
}
