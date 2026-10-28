import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-8 w-8", className)}>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="currentColor" />
      <path d="M10 10h12M10 15h8M10 20h12M10 25h5" stroke="var(--mint)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="23.5" cy="24" r="2.4" fill="var(--violet)" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact = false, tone = "dark" }: { href?: string; className?: string; compact?: boolean; tone?: "dark" | "light" }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", tone === "light" ? "text-white" : "text-ink", className)}
      aria-label="Janngude — accueil"
    >
      <LogoMark className={tone === "light" ? "text-white/10" : "text-ink"} />
      {!compact && <span className="text-[24px] font-semibold tracking-tight">Janngude</span>}
    </Link>
  );
}
