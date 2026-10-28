import Link from "next/link";
import { FileText, ListChecks, Headphones, MessagesSquare, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHARE_TYPE_LABEL } from "@/lib/share";
import type { ReceivedShare, ShareResourceType } from "@/lib/supabase/types";

const STYLE: Record<ShareResourceType, { bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  summary: { bg: "bg-sky", icon: FileText },
  quiz: { bg: "bg-lemon", icon: ListChecks },
  audio: { bg: "bg-lavender", icon: Headphones },
  chat: { bg: "bg-mint", icon: MessagesSquare },
  course: { bg: "bg-violet", icon: BookOpen },
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(value)).replace(".", "");
}

/** Carte pastel d’un contenu reçu (style « événement »). */
export function SharedCard({ share, className }: { share: ReceivedShare; className?: string }) {
  const { bg, icon: Icon } = STYLE[share.resource_type];
  return (
    <Link href={`/s/${share.token}`} className={cn("block rounded-[26px] p-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float", bg, className)}>
      <div className="flex items-center justify-between gap-3 px-1 text-[14px] font-medium text-ink">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" /> {SHARE_TYPE_LABEL[share.resource_type]}
        </span>
        <span className="text-ink-2/70">{shortDate(share.saved_at ?? share.created_at)}</span>
      </div>
      <p className="mt-3 rounded-[20px] bg-white/70 px-4 py-3 text-[15px] leading-snug text-ink line-clamp-3">{share.title}</p>
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-[13px] text-ink-2/80">Par {share.owner_name}</span>
        <span className="rounded-full bg-white px-3 py-1 text-[13px] font-medium text-ink">Ouvrir</span>
      </div>
    </Link>
  );
}
