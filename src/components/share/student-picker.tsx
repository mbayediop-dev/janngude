"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { StudentMatch } from "@/lib/supabase/types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Champ avec autocomplétion : nom, téléphone ou e-mail d’un étudiant inscrit.
 * `onSubmit` reçoit l’e-mail choisi (ou le texte saisi s’il s’agit déjà d’un e-mail).
 */
export function StudentPicker({ onSubmit, loading, inputId }: { onSubmit: (email: string, student: StudentMatch | null) => void; loading?: boolean; inputId?: string }) {
  const listId = useId();
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<StudentMatch | null>(null);
  const [results, setResults] = useState<{ q: string; items: StudentMatch[] }>({ q: "", items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim();
  const items = open && q.length >= 2 && results.q === q && !selected ? results.items : [];

  useEffect(() => {
    if (q.length < 2 || selected) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/students/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ students: StudentMatch[] }>) : Promise.resolve({ students: [] })))
        .then((d) => {
          setResults({ q, items: d.students });
          setActive(0);
        })
        .catch(() => {});
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, selected]);

  function choose(s: StudentMatch) {
    setSelected(s);
    setValue(s.email);
    setOpen(false);
    inputRef.current?.focus();
  }

  function submit() {
    if (selected) return onSubmit(selected.email, selected);
    if (EMAIL_RE.test(q)) return onSubmit(q.toLowerCase(), null);
    if (items.length) return choose(items[active] ?? items[0]);
    onSubmit(q, null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSelected(null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Nom, téléphone ou e-mail"
            className="h-11 w-full rounded-full bg-surface-2 pl-10 pr-4 text-[15px] text-ink outline-none transition-[background-color,box-shadow] placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-ink/10"
          />
        </div>
        <Button onClick={submit} loading={loading} disabled={!q}>
          <Send className="h-4 w-4" /> Envoyer
        </Button>
      </div>

      {selected ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
          <Avatar name={selected.name} size="sm" />
          <span className="font-medium text-ink">{selected.name}</span>
          <span className="text-muted">· {selected.email}{selected.phone ? ` · ${formatPhone(selected.phone)}` : ""}</span>
        </p>
      ) : null}

      {items.length ? (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-[22px] bg-surface p-1.5 shadow-float">
          {items.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-[16px] px-3 py-2", i === active ? "bg-mint/70" : "hover:bg-surface-2")}
            >
              <Avatar name={s.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  {s.email}
                  {s.phone ? ` · ${formatPhone(s.phone)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {open && q.length >= 2 && results.q === q && !results.items.length && !selected && !EMAIL_RE.test(q) ? (
        <p className="mt-2 text-[12px] text-muted">Aucun étudiant inscrit ne correspond. Saisissez son adresse e-mail complète pour l’inviter.</p>
      ) : null}
    </div>
  );
}
