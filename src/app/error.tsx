"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Khadija } from "@/components/brand/khadija";
import { Button } from "@/components/ui/button";

/** Erreur inattendue (limite d’erreur de l’application) : Khadija s’excuse et propose de réessayer. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <Khadija pose="oops" className="mt-8 h-36 w-36" />
      <h1 className="mt-6 text-[40px] font-semibold leading-none tracking-tight text-ink">Oups, un imprévu 🙈</h1>
      <p className="mt-3 max-w-md text-sm text-muted">Quelque chose n’a pas fonctionné de notre côté. Réessayez dans un instant ; si le problème persiste, revenez à vos cours.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Réessayer</Button>
        <Button asChild variant="outline">
          <Link href="/app">Mes cours</Link>
        </Button>
      </div>
    </div>
  );
}
