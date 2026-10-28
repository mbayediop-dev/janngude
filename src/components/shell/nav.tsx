"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Inbox, Settings, Plus, Brain, TimerReset, Users, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/app", label: "Mes cours", icon: GraduationCap, excludes: ["/app/shared", "/app/settings", "/app/review", "/app/exams", "/app/groups", "/app/search"] },
  { href: "/app/review", label: "Révisions", icon: Brain },
  { href: "/app/exams", label: "Examens", icon: TimerReset, mobile: false },
  { href: "/app/groups", label: "Groupes", icon: Users },
  { href: "/app/shared", label: "Partagés avec moi", icon: Inbox },
  { href: "/app/search", label: "Recherche", icon: Search, mobile: false },
  { href: "/app/settings", label: "Paramètres", icon: Settings, mobile: false },
];

function isActive(pathname: string, item: (typeof items)[number]) {
  return item.excludes ? pathname.startsWith(item.href) && !item.excludes.some((e) => pathname.startsWith(e)) : pathname.startsWith(item.href);
}

/** Navigation centrale de la barre sombre : icônes, libellé visible sur l’élément actif. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Navigation principale">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full px-2.5 text-[15px] font-medium transition-colors sm:px-3",
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              "mobile" in item && item.mobile === false && "hidden md:inline-flex",
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className={cn("hidden md:inline", !active && "md:hidden")}>{item.label}</span>
          </Link>
        );
      })}
      <Link
        href="/app/courses/new"
        className="ml-1 inline-flex h-11 items-center gap-2 rounded-full bg-mint px-3 text-[15px] font-semibold text-primary-ink transition-colors hover:bg-white sm:px-4"
        title="Nouveau cours"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden lg:inline">Nouveau cours</span>
      </Link>
    </nav>
  );
}

export function NewCourseButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-[52px] px-7 text-[15px]" };
  return (
    <Link href="/app/courses/new" className={cn("inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium text-white transition-colors hover:bg-black", sizes[size], className)}>
      <Plus className="h-4 w-4" />
      Nouveau cours
    </Link>
  );
}
