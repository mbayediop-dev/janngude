import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { KhadijaFigure } from "@/components/brand/khadija";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <Link href="/" className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-ink hover:bg-white">
          Retour au site
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[440px] animate-rise md:grid md:max-w-[760px] md:grid-cols-[224px_minmax(0,1fr)] md:items-start md:gap-8">
          <KhadijaFigure layout="auto" pose="hello" size="md" className="mb-5 md:mb-0">
            Bonjour ! Je suis Khadija, votre assistante de révision. Je vous attends dans votre espace.
          </KhadijaFigure>
          <div className="min-w-0 md:max-w-[480px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
