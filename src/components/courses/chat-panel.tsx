"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Send, Share2, Download, Trash2, MessagesSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui/spinner";
import { ShareDialog } from "@/components/share/share-dialog";
import { apiJson, readNdjson } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import type { ChatRow, ChatMessageRow } from "@/lib/supabase/types";

type Msg = Pick<ChatMessageRow, "id" | "role" | "content">;
type DoneEvent = { chat: ChatRow; userMessage: ChatMessageRow; assistantMessage: ChatMessageRow };

export function ChatPanel({ courseId, courseTitle, initialChats, initialChatId = null, keywords }: { courseId: string; courseTitle: string; initialChats: ChatRow[]; initialChatId?: string | null; keywords: string[] }) {
  const [chats, setChats] = useState(initialChats);
  // Discussion ouverte au départ : celle demandée par l’URL (reprise d’un partage), sinon la plus récente.
  const [activeId, setActiveId] = useState<string | null>(initialChatId && initialChats.some((c) => c.id === initialChatId) ? initialChatId : (initialChats[0]?.id ?? null));
  // Messages chargés pour une discussion donnée (null = nouvelle discussion).
  const [store, setStore] = useState<{ chatId: string | null; messages: Msg[] }>({ chatId: null, messages: [] });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tempCounter = useRef(0);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const loadingMessages = activeId !== null && store.chatId !== activeId;
  const messages = useMemo(() => (store.chatId === activeId ? store.messages : []), [store, activeId]);

  useEffect(() => {
    if (!activeId || store.chatId === activeId) return;
    let cancelled = false;
    apiJson<{ messages: Msg[] }>(`/api/chats/${activeId}`)
      .then((d) => {
        if (!cancelled) setStore({ chatId: activeId, messages: d.messages });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"));
    return () => {
      cancelled = true;
    };
  }, [activeId, store.chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, draft]);

  function startNewChat() {
    setActiveId(null);
    setStore({ chatId: null, messages: [] });
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setStreaming(true);
    setDraft("");
    const chatIdAtSend = activeId;
    const tempId = `tmp-${++tempCounter.current}`;
    setStore((s) => ({ chatId: chatIdAtSend, messages: [...(s.chatId === chatIdAtSend ? s.messages : []), { id: tempId, role: "user", content }] }));

    const result: { done: DoneEvent | null } = { done: null };
    try {
      const res = await fetch(`/api/courses/${courseId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatIdAtSend ?? undefined, message: content }),
      });
      await readNdjson(res, (ev) => {
        if (ev.type === "delta") setDraft((d) => d + (ev.text as string));
        if (ev.type === "done") result.done = ev as unknown as DoneEvent;
        if (ev.type === "error") throw new Error(ev.message as string);
      });
      const d = result.done;
      if (d) {
        setStore((s) => ({ chatId: d.chat.id, messages: [...s.messages.filter((x) => x.id !== tempId), d.userMessage, d.assistantMessage] }));
        setChats((list) => {
          const exists = list.some((c) => c.id === d.chat.id);
          const next = exists ? list.map((c) => (c.id === d.chat.id ? d.chat : c)) : [d.chat, ...list];
          return [...next].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        });
        setActiveId(d.chat.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setStore((s) => ({ ...s, messages: s.messages.filter((x) => x.id !== tempId) }));
      setInput(content);
    } finally {
      setStreaming(false);
      setDraft("");
      textareaRef.current?.focus();
    }
  }

  async function removeChat(id: string) {
    if (!confirm("Supprimer cette discussion ?")) return;
    try {
      await apiJson(`/api/chats/${id}`, { method: "DELETE" });
      const next = chats.filter((c) => c.id !== id);
      setChats(next);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
        setStore({ chatId: null, messages: [] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  const suggestions = [
    "Explique-moi les notions les plus importantes de ce cours.",
    "Quelles sont les erreurs fréquentes à éviter sur ce chapitre ?",
    keywords[0] ? `Peux-tu m’expliquer « ${keywords[0]} » avec un exemple concret ?` : "Donne-moi un exemple concret tiré du cours.",
    "Pose-moi trois questions pour vérifier ma compréhension.",
  ];

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-2">
        <Button variant={activeId ? "outline" : "primary"} className="w-full justify-start" onClick={startNewChat}>
          <Plus className="h-4 w-4" /> Nouvelle discussion
        </Button>
        {chats.length ? (
          <ul className="space-y-1.5">
            {chats.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn("w-full rounded-[18px] px-4 py-3 pr-9 text-left transition-[background-color,box-shadow]", activeId === c.id ? "bg-surface shadow-card ring-2 ring-ink" : "bg-surface/60 hover:bg-surface")}
                >
                  <span className="block truncate text-sm font-medium text-ink">{c.title}</span>
                  <span className="block text-[12px] text-muted">{formatDate(c.updated_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </button>
                <button type="button" onClick={() => removeChat(c.id)} className="absolute right-2 top-2.5 rounded-full p-1 text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100" aria-label="Supprimer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      <div className="flex min-h-[560px] min-w-0 flex-col rounded-[28px] bg-surface shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{active?.title ?? "Nouvelle discussion"}</p>
          {active ? (
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/export/pdf?type=chat&id=${active.id}`}>
                  <Download className="h-4 w-4" /> PDF
                </a>
              </Button>
              <ShareDialog
                type="chat"
                id={active.id}
                title={`${courseTitle} — ${active.title}`}
                downloads={[{ label: "PDF", href: `/api/export/pdf?type=chat&id=${active.id}` }]}
                trigger={
                  <Button size="sm">
                    <Share2 className="h-4 w-4" /> Partager
                  </Button>
                }
              />
            </div>
          ) : null}
        </header>

        <div className="min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 scrollbar-thin sm:px-5">
          {loadingMessages ? (
            <div className="flex justify-center py-10 text-muted">
              <Spinner />
            </div>
          ) : messages.length === 0 && !draft ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mint text-ink">
                <MessagesSquare className="h-6 w-6" />
              </span>
              <p className="text-base font-semibold text-ink">Posez toutes vos questions sur ce cours</p>
              <p className="mt-1 max-w-sm text-sm text-muted">L’assistant répond à partir du contenu du cours et vous aide à vérifier votre compréhension.</p>
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-2xl bg-surface-2 px-4 py-3 text-left text-[13px] text-ink-2 transition-colors hover:bg-mint">
                    <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-ink" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} content={m.content} />
              ))}
              {streaming ? <Bubble role="assistant" content={draft} pending /> : null}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-line p-3"
        >
          <div className="flex items-end gap-2 rounded-[26px] bg-surface-2 p-1.5 focus-within:bg-surface focus-within:ring-2 focus-within:ring-ink/15">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Votre question… (Entrée pour envoyer, Maj+Entrée pour un retour à la ligne)"
              className="min-h-10 max-h-40 resize-none border-0 bg-transparent shadow-none focus:ring-0"
              disabled={streaming}
            />
            <Button type="submit" size="icon" loading={streaming} disabled={!input.trim()} aria-label="Envoyer">
              {!streaming ? <Send className="h-4 w-4" /> : null}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Bubble({ role, content, pending }: { role: "user" | "assistant"; content: string; pending?: boolean }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap">{content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint text-ink">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 max-w-[90%]">
        {content ? <Markdown content={content} className="prose-sm" /> : null}
        {pending ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" /> : null}
      </div>
    </div>
  );
}
