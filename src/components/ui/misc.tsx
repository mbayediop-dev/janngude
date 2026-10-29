import * as React from "react";
import { cn, initials } from "@/lib/utils";
import { Khadija, type KhadijaPose } from "@/components/brand/khadija";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-2xl bg-surface-3", className)} aria-hidden />;
}

export function Avatar({ name, src, className, size = "md" }: { name?: string | null; src?: string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-9 w-9 text-[13px]" : size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-[15px]";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? ""} className={cn("rounded-full object-cover", dim, className)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-mint font-semibold text-primary-ink", dim, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "accent" | "success" | "danger" }) {
  const color = { primary: "bg-ink", accent: "bg-accent", success: "bg-success", danger: "bg-danger" }[tone];
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  mascot,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  /** Khadija à la place de l’icône (humeur et accessoire selon le contexte). */
  mascot?: { pose: KhadijaPose; bg?: "mint" | "sky" | "lavender" | "lemon" | "pink" | "violet" };
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center", className)}>
      {mascot ? <Khadija pose={mascot.pose} bg={mascot.bg ?? "none"} className="mb-3 h-36 w-36" /> : null}
      {icon && !mascot ? <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-primary-ink [&_svg]:h-6 [&_svg]:w-6">{icon}</div> : null}
      <h3 className="text-[18px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-[12px] uppercase tracking-wider text-muted", className)}>
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function PageHeader({ title, emoji, description, actions, eyebrow }: { title: string; emoji?: string; description?: string; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[42px]">
          {title}
          {emoji ? <>&nbsp;<span className="align-middle">{emoji}</span></> : null}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-surface-2 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-9 rounded-full px-4 text-[13px] font-medium transition-all", value === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pastille ronde décorative en coin de carte (icône sur fond pastel). */
export function CornerBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("absolute -right-2 -top-2 flex h-12 w-12 items-center justify-center rounded-full bg-mint text-ink shadow-card [&_svg]:h-5 [&_svg]:w-5", className)}>
      {children}
    </span>
  );
}
