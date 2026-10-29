import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Khadija } from "@/components/brand/khadija";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <Khadija pose="surprise" className="mt-8 h-36 w-36" />
      <h1 className="mt-6 text-[40px] font-semibold leading-none tracking-tight text-ink">Page introuvable 🧭</h1>
      <p className="mt-3 max-w-md text-sm text-muted">Khadija a cherché partout : ce lien n’existe pas ou n’est plus disponible. Vérifiez l’adresse, ou revenez à l’accueil.</p>
      <Button asChild className="mt-8">
        <Link href="/">Retour à l’accueil</Link>
      </Button>
    </div>
  );
}
