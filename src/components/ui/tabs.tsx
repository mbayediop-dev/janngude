"use client";

import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex h-12 items-center gap-1 rounded-full bg-surface-2 p-1 text-muted", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-all hover:text-ink data-[state=active]:bg-ink data-[state=active]:text-white disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, keepMounted, ...props }: React.ComponentProps<typeof T.Content> & { keepMounted?: boolean }) {
  // keepMounted : le panneau reste monté (état, générations en cours) et n’est que masqué quand l’onglet est inactif.
  return <T.Content forceMount={keepMounted ? true : undefined} className={cn("focus-visible:outline-none", keepMounted && "data-[state=inactive]:hidden", className)} {...props} />;
}

/** Onglets en pilules blanches (barres de page). */
export function TabsBar({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export function TabsBarTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink-2 shadow-card whitespace-nowrap transition-colors hover:text-ink data-[state=active]:bg-ink data-[state=active]:text-white",
        className,
      )}
      {...props}
    />
  );
}

/** Barre d’outils flottante noire avec boutons ronds colorés. */
export function TabsDock({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn(
        // Sur téléphone, au-dessus de la barre de navigation flottante ; sur grand écran, en bas de la fenêtre.
        "fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full bg-ink p-2 shadow-pop scrollbar-thin md:bottom-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsDockTrigger({ className, color, icon, label, ...props }: Omit<React.ComponentProps<typeof T.Trigger>, "children"> & { color: string; icon: React.ReactNode; label: string }) {
  return (
    <T.Trigger
      className={cn(
        "dock-trigger inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-ink transition-[box-shadow,transform] hover:-translate-y-0.5 data-[state=active]:px-4 sm:px-3.5 sm:data-[state=active]:px-5 [&_svg]:h-5 [&_svg]:w-5",
        color,
        className,
      )}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
      <span className="dock-label text-sm font-semibold">{label}</span>
    </T.Trigger>
  );
}
