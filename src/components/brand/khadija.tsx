import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Khadija, la mascotte et assistante de Janngude : illustrations fournies par le client
 * (`public/khadija/<pose>.png`, 360 × 360, fond transparent). Chaque endroit de l’application
 * utilise la pose qui correspond au contexte (voir CLAUDE.md, « Mascotte Khadija »).
 */
export const KHADIJA_POSES = [
  "hello", "thumbsup", "cheer", "love", "think", "idea", "laptop", "study", "books", "phone", "point", "confident", "surprise", "ok", "tablet", "zen",
  "headphones", "microphone", "upload", "flashcards", "graduate", "trophy", "oops", "encourage", "search", "friends", "timer", "offline", "admin", "install",
] as const;
export type KhadijaPose = (typeof KHADIJA_POSES)[number];
export type KhadijaBg = "mint" | "sky" | "lavender" | "lemon" | "pink" | "violet" | "white" | "none";

const BG: Record<Exclude<KhadijaBg, "none">, string> = {
  mint: "bg-mint",
  sky: "bg-sky",
  lavender: "bg-lavender",
  lemon: "bg-lemon",
  pink: "bg-pink",
  violet: "bg-violet",
  white: "bg-white",
};

export function Khadija({
  pose = "hello",
  bg = "none",
  className,
  title = "Khadija",
  priority = false,
}: {
  pose?: KhadijaPose;
  /** Pastille ronde pastel derrière le buste (avatar) ; sans pastille, l’illustration est affichée entière. */
  bg?: KhadijaBg;
  className?: string;
  title?: string;
  priority?: boolean;
}) {
  const round = bg !== "none";
  return (
    <span className={cn("relative block h-24 w-24 shrink-0 select-none", round && cn("overflow-hidden rounded-full", BG[bg as Exclude<KhadijaBg, "none">]), className)} role="img" aria-label={title}>
      <Image
        src={`/khadija/${pose}.png`}
        alt=""
        width={360}
        height={360}
        priority={priority}
        draggable={false}
        sizes="(max-width: 640px) 180px, 240px"
        className={cn("h-full w-full object-contain object-bottom", round && "origin-bottom scale-[1.12]")}
      />
    </span>
  );
}

const FIGURE = {
  sm: { row: "h-24 w-24", column: "h-40 w-40", auto: "h-24 w-24 md:h-44 md:w-44" },
  md: { row: "h-32 w-32", column: "h-52 w-52", auto: "h-28 w-28 md:h-56 md:w-56" },
  lg: { row: "h-40 w-40", column: "h-64 w-64", auto: "h-32 w-32 md:h-64 md:w-64" },
} as const;

/**
 * Khadija en grand avec une bulle de dialogue (jamais en pastille).
 * - `row` : Khadija à gauche, bulle à côté (bandeaux, accueils).
 * - `column` : bulle au-dessus d’elle, avec une pointe (à côté d’une carte ou d’un formulaire).
 * - `auto` : `row` sur téléphone, `column` à partir de `md`.
 */
export function KhadijaFigure({
  children,
  pose = "hello",
  layout = "row",
  size = "md",
  bubbleClassName,
  className,
}: {
  children: React.ReactNode;
  pose?: KhadijaPose;
  layout?: "row" | "column" | "auto";
  size?: keyof typeof FIGURE;
  bubbleClassName?: string;
  className?: string;
}) {
  const bubble = cn("relative rounded-[22px] bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink shadow-card", bubbleClassName);
  if (layout === "column") {
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <div className={cn(bubble, "w-full")}>
          {children}
          <span aria-hidden className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-surface" />
        </div>
        <Khadija pose={pose} className={cn("mt-3", FIGURE[size].column)} />
      </div>
    );
  }
  if (layout === "auto") {
    return (
      <div className={cn("flex items-end gap-3 md:flex-col md:items-center", className)}>
        <Khadija pose={pose} className={cn("shrink-0 md:order-2", FIGURE[size].auto)} />
        <div className={cn(bubble, "min-w-0 flex-1 rounded-bl-md md:order-1 md:w-full md:flex-none md:rounded-bl-[22px]")}>
          {children}
          <span aria-hidden className="absolute -bottom-2 left-1/2 hidden h-4 w-4 -translate-x-1/2 rotate-45 bg-surface md:block" />
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-end gap-3 sm:gap-4", className)}>
      <Khadija pose={pose} className={cn("shrink-0", FIGURE[size].row)} />
      <div className={cn(bubble, "min-w-0 flex-1 rounded-bl-md")}>{children}</div>
    </div>
  );
}
