"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Inbox, Settings, Plus, Brain, TimerReset, Users, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Mes cours", icon: GraduationCap, excludes: ["/app/shared", "/app/settings", "/app/review", "/app/exams", "/app/groups", "/app/search", "/app/courses/new"] },
  { href: "/app/review", label: "Révisions", icon: Brain },
  { href: "/app/exams", label: "Examens", icon: TimerReset },
  { href: "/app/groups", label: "Groupes", icon: Users },
  { href: "/app/shared", label: "Partagés avec moi", icon: Inbox },
  { href: "/app/search", label: "Recherche", icon: Search },
  { href: "/app/settings", label: "Paramètres", icon: Settings },
];

function isActive(pathname: string, item: { href: string; excludes?: string[] }) {
  return item.excludes ? pathname.startsWith(item.href) && !item.excludes.some((e) => pathname.startsWith(e)) : pathname.startsWith(item.href);
}

/** Navigation centrale de la barre sombre (écrans moyens et larges) : icônes, libellé visible sur l’élément actif. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex lg:gap-2" aria-label="Navigation principale">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full px-2.5 text-[15px] font-medium transition-colors lg:px-3",
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className={cn("hidden xl:inline", !active && "xl:hidden")}>{item.label}</span>
          </Link>
        );
      })}
      <Link
        href="/app/courses/new"
        className="ml-1 inline-flex h-11 items-center gap-2 rounded-full bg-mint px-3 text-[15px] font-semibold text-primary-ink transition-colors hover:bg-white lg:px-4"
        title="Nouveau cours"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden lg:inline">Nouveau cours</span>
      </Link>
    </nav>
  );
}

const mobileItems = [
  { href: "/app", label: "Cours", icon: GraduationCap, excludes: items[0].excludes },
  { href: "/app/review", label: "Révisions", icon: Brain },
  { href: "/app/courses/new", label: "Nouveau cours", icon: Plus, primary: true },
  { href: "/app/groups", label: "Groupes", icon: Users },
  { href: "/app/shared", label: "Partagés", icon: Inbox },
];

/** Barre de navigation flottante en bas de l’écran sur téléphone (les autres entrées sont dans le menu du compte). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation" className="fixed inset-x-3 z-40 md:hidden" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <ul className="grid grid-cols-5 items-center rounded-[26px] bg-surface/95 px-1 py-1.5 shadow-pop backdrop-blur">
        {mobileItems.map((item) => {
          const active = isActive(pathname, item);
          if ("primary" in item && item.primary) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link href={item.href} aria-label={item.label} title={item.label} className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-float transition-transform active:scale-95">
                  <Plus className="h-6 w-6" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 rounded-2xl py-1 text-[11px] font-medium transition-colors", active ? "text-ink" : "text-muted")}>
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", active ? "bg-mint text-ink" : "")}>
                  <item.icon className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NewCourseButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-[52px] px-7 text-[15px]" };
  return (
    <Link href="/app/courses/new" className={cn("inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium text-white transition-colors hover:bg-black", sizes[size], className)}>
      <Plus className="h-4 w-4" /> Nouveau cours
    </Link>
  );
}
