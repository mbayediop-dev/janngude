"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, ShieldCheck, TimerReset, Search, Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function UserMenu({ name, email, avatarUrl, isAdmin = false }: { name: string; email: string; avatarUrl: string | null; isAdmin?: boolean }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Déconnexion côté client, puis retour à l’accueil avec rafraîchissement des composants serveur.
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 text-left text-white transition-colors hover:bg-white/10" aria-label="Menu du compte">
          <Avatar name={name} src={avatarUrl} size="sm" />
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-[15px] font-semibold leading-tight">{name}</span>
            <span className="block truncate text-[12px] text-white/60">{email}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 text-white/70 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-ink">{name}</span>
          <span className="block truncate font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <Settings /> Paramètres
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/app/exams">
            <TimerReset /> Examens blancs
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link href="/app/search">
            <Search /> Recherche
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/offline.html">
            <Headphones /> Écoute hors ligne
          </a>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> Administration
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void signOut()} disabled={signingOut}>
          <LogOut /> {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
