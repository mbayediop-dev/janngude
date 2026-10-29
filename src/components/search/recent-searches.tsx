"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { History, X } from "lucide-react";

const KEY = "janngude:searches";
const EVENT = "janngude:searches";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}
function snapshot() {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}
function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Mémorise la recherche courante dans l’historique local. */
export function RememberSearch({ q }: { q: string }) {
  useEffect(() => {
    const value = q.trim();
    if (!value) return;
    write([value, ...read().filter((s) => s.toLowerCase() !== value.toLowerCase())]);
  }, [q]);
  return null;
}

/** Recherches récentes (navigateur), en pastilles cliquables. */
export function RecentSearches() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  let list: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    list = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    list = [];
  }
  if (!list.length) return null;
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted">
          <History className="h-3.5 w-3.5" /> Recherches récentes
        </h2>
        <button type="button" onClick={() => write([])} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
          <X className="h-3 w-3" /> Effacer
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((s) => (
          <Link key={s} href={`/app/search?q=${encodeURIComponent(s)}`} className="rounded-full bg-surface px-3.5 py-2 text-[13px] font-medium text-ink shadow-card hover:bg-surface-2">
            {s}
          </Link>
        ))}
      </div>
    </section>
  );
}
