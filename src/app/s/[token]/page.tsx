import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { SharedView } from "@/components/share/shared-view";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shareUrl } from "@/lib/share";
import type { SharePayload } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Contenu partagé" };

export default function SharePage({ params }: PageProps<"/s/[token]">) {
  return (
    <div className="min-h-dvh p-2 sm:p-4">
      <div className="flex min-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[32px] bg-ink sm:min-h-[calc(100dvh-2rem)] sm:rounded-[40px]">
        <header className="flex h-[76px] items-center justify-between gap-3 px-4 sm:px-7">
          <Logo tone="light" />
          <Suspense fallback={<Skeleton className="h-10 w-28 rounded-full bg-white/10" />}>
            <HeaderActions />
          </Suspense>
        </header>
        <div className="relative mx-2 mb-2 flex-1 rounded-[28px] bg-paper sm:mx-3 sm:mb-3 sm:rounded-[34px]">
          <span aria-hidden className="absolute left-1/2 top-0 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-ink" />
          <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
            <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-[28px]" />}>
              <SharedContent params={params} />
            </Suspense>
          </main>
          <footer className="pb-6 text-center text-[13px] text-muted">
            Janngude, réviser mieux, plus vite.{" "}
            <Link href="/" className="font-medium text-ink underline hover:no-underline">
              Découvrir l’application
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}

async function HeaderActions() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Button asChild variant="white" size="sm">
        <Link href="/app">Mon espace</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className="hidden rounded-full px-4 py-2 text-[15px] font-medium text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex">
        Se connecter
      </Link>
      <Button asChild variant="white" size="sm">
        <Link href="/signup">Créer un compte</Link>
      </Button>
    </div>
  );
}

async function SharedContent({ params }: { params: PageProps<"/s/[token]">["params"] }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_share", { p_token: token });
  if (!data) notFound();
  const payload = data as unknown as SharePayload;
  const user = await getCurrentUser();
  return <SharedView payload={payload} viewer={user ? { id: user.id, name: user.name } : null} url={shareUrl(token)} />;
}
