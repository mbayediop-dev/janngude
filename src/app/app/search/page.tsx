import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { Skeleton, PageHeader, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
  await requireUser();
  const supabase = await createClient();
  const { data } = q ? await supabase.rpc("search_courses", { p_query: q, p_limit: 30 }) : { data: [] as SearchResult[] };
  const results = (data ?? []) as SearchResult[];

  return (
    <div className="space-y-6">
      <form action="/app/search" method="get" className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Ex. force majeure, SIEM, mitose…"
          aria-label="Rechercher"
          autoFocus
          className="h-14 w-full rounded-full bg-surface pl-12 pr-32 text-[15px] text-ink shadow-card outline-none placeholder:text-muted focus:ring-2 focus:ring-ink/10"
        />
        <button type="submit" className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-black">
          Chercher
        </button>
      </form>

      {!q ? null : results.length === 0 ? (
        <EmptyState icon={<Search />} title={`Aucun résultat pour « ${q} »`} description="Essayez un autre mot, au singulier, ou une notion plus générale. La recherche porte sur les cours analysés." />
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {results.length} résultat{results.length > 1 ? "s" : ""} pour « {q} »
          </p>
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.id}>
                <Link href={`/app/courses/${r.id}`} className="block rounded-[22px] bg-surface p-5 shadow-card transition-colors hover:bg-surface-2/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold text-ink">{r.title}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone="mint">{r.domain}</Badge>
                        <Badge tone="lavender">{r.subject}</Badge>
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                    <Headline text={r.headline} />
                  </p>
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
