import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight, Tag, Lightbulb, Quote, Hash } from "lucide-react";
import { Skeleton, PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { DomainIcon } from "@/components/dashboard/domain-icon";
import { Khadija } from "@/components/brand/khadija";
import { RecentSearches, RememberSearch } from "@/components/search/recent-searches";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Recherche" };

export default function SearchPage({ searchParams }: PageProps<"/app/search">) {
  return (
    <>
      <PageHeader title="Recherche" emoji="🔎" description="Cherchez une notion, une définition, un mot-clé dans tous vos cours, résumés et points à retenir." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-[28px]" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/app/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: courses }] = await Promise.all([
    q ? supabase.rpc("search_courses", { p_query: q, p_limit: 30 }) : Promise.resolve({ data: [] as SearchResult[] }),
    supabase.from("courses").select("id,title,keywords").eq("user_id", user.id).eq("status", "ready").order("updated_at", { ascending: false }).limit(40),
  ]);
  const results = (data ?? []) as SearchResult[];
  const readyCourses = courses ?? [];
  // Mots-clés tirés des analyses, dédoublonnés sans tenir compte de la casse.
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const c of readyCourses) for (const k of c.keywords ?? []) {
    const key = k.trim().toLowerCase();
    if (key && !seen.has(key) && keywords.length < 16) {
      seen.add(key);
      keywords.push(k.trim());
    }
  }

  return (
    <div className="space-y-8">
      <form action="/app/search" method="get" className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Ex. force majeure, SIEM, mitose…"
          aria-label="Rechercher"
          autoFocus
          className="h-14 w-full rounded-full bg-surface pl-13 pr-32 text-[15px] text-ink shadow-card outline-none placeholder:text-muted focus:ring-2 focus:ring-ink/10"
        />
        <button type="submit" className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-black">
          Chercher
        </button>
      </form>
      {q ? <RememberSearch q={q} /> : null}

      {!q ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-7">
            <RecentSearches />
            {keywords.length ? (
              <section>
                <h2 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted">
                  <Tag className="h-3.5 w-3.5" /> Mots-clés de vos cours
                </h2>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k, i) => (
                    <Link key={k} href={`/app/search?q=${encodeURIComponent(k)}`} className={cn("rounded-full px-3.5 py-2 text-[13px] font-medium text-ink transition-transform hover:-translate-y-0.5", ["bg-mint", "bg-sky", "bg-lavender", "bg-lemon", "bg-pink"][i % 5])}>
                      {k}
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <p className="rounded-[22px] bg-surface p-5 text-sm text-muted shadow-card">Déposez un cours pour pouvoir y chercher : titres, texte intégral, résumés et points à retenir sont indexés dès l’analyse.</p>
            )}
          </div>
          <aside className="rounded-[28px] bg-surface p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                Comment chercher&nbsp;<span className="align-middle">💡</span>
              </h2>
              <Khadija pose="search" className="-mr-3 -mt-4 h-24 w-24 shrink-0" />
            </div>
            <p className="mt-2 text-[13px] text-muted">
              La recherche porte sur {readyCourses.length} cours analysé{readyCourses.length > 1 ? "s" : ""} : titres, texte intégral, résumés et points à retenir.
            </p>
            <ul className="mt-4 space-y-3">
              {[
                { icon: Quote, bg: "bg-mint", title: "Une notion ou une définition", text: "« force majeure », « équilibre du consommateur » : les extraits correspondants s’affichent avec le mot surligné." },
                { icon: Hash, bg: "bg-sky", title: "Un sigle ou un terme technique", text: "« SIEM », « ADN », « TVA » : même dans un cours de plusieurs dizaines de pages." },
                { icon: Lightbulb, bg: "bg-lemon", title: "Un mot au singulier", text: "Les variantes proches sont trouvées automatiquement ; inutile d’ajouter des guillemets." },
              ].map((t) => (
                <li key={t.title} className="flex gap-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink", t.bg)}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{t.title}</p>
                    <p className="text-[12px] leading-snug text-muted">{t.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      ) : results.length === 0 ? (
        <EmptyState mascot={{ pose: "think" }} title={`Aucun résultat pour « ${q} »`} description="Essayez un autre mot, au singulier, ou une notion plus générale. La recherche porte sur les cours analysés." />
      ) : (
        <>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <span className="rounded-full bg-surface px-2.5 py-0.5 font-semibold text-ink shadow-card">{results.length}</span>
            résultat{results.length > 1 ? "s" : ""} pour « {q} »
          </p>
          <ul className="grid gap-3 xl:grid-cols-2">
            {results.map((r) => (
              <li key={r.id}>
                <Link href={`/app/courses/${r.id}`} className="group flex h-full gap-4 rounded-[24px] bg-surface p-5 shadow-card transition-colors hover:bg-surface-2/40">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
                    <DomainIcon domain={r.domain} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[16px] font-semibold leading-snug text-ink">{r.title}</p>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="mint">{r.domain}</Badge>
                      <Badge tone="lavender">{r.subject}</Badge>
                    </p>
                    <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                      <Headline text={r.headline} />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Rend les extraits renvoyés par PostgreSQL (balises <mark>) sans injecter de HTML. */
function Headline({ text }: { text: string }) {
  const parts = text.split(/(<mark>.*?<\/mark>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^<mark>(.*?)<\/mark>$/.exec(part);
        return m ? (
          <mark key={i} className="rounded bg-lemon px-0.5 text-ink">
            {m[1]}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}
