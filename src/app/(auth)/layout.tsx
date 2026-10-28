import Link from "next/link";
import { Logo } from "@/components/brand/logo";

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
        <div className="w-full max-w-[440px] animate-rise">{children}</div>
      </main>
    </div>
  );
}
