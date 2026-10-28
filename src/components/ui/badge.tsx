import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "accent" | "success" | "danger" | "info" | "outline" | "mint" | "sky" | "lavender" | "lemon" | "pink";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  primary: "bg-mint text-primary-ink",
  accent: "bg-lemon text-[#6b4d00]",
  success: "bg-mint text-success",
  danger: "bg-danger-soft text-danger",
  info: "bg-sky text-info",
  outline: "border border-dashed border-line-strong text-ink-2 bg-transparent",
  mint: "bg-mint text-primary-ink",
  sky: "bg-sky text-info",
  lavender: "bg-lavender text-[#4b2a73]",
  lemon: "bg-lemon text-[#6b4d00]",
  pink: "bg-pink text-[#7a2a66]",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium leading-5 whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}
