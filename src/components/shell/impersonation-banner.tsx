import { Undo2 } from "lucide-react";
import { Khadija } from "@/components/brand/khadija";
import { getCurrentUser } from "@/lib/auth";
import { readImpersonation } from "@/lib/impersonation";

/** Bandeau affiché quand un administrateur consulte l’espace d’un étudiant (cookie signé + session correspondante). */
export async function ImpersonationBanner() {
  const session = await readImpersonation();
  if (!session) return null;
  const user = await getCurrentUser();
  if (!user || user.id !== session.targetId) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-[22px] bg-lemon px-4 py-3 text-[#6b4d00] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="flex items-center gap-3 text-sm">
        <Khadija pose="admin" className="-my-2 h-12 w-12 shrink-0" />
        <span>
          Vous consultez l’espace de <strong className="font-semibold text-ink">{user.name}</strong> ({user.email}) en tant qu’administrateur. Ce que vous faites ici est enregistré dans son compte.
        </span>
      </p>
      <form method="post" action="/api/admin/impersonate/stop" className="shrink-0">
        <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-black">
          <Undo2 className="h-4 w-4" /> Revenir à mon compte
        </button>
      </form>
    </div>
  );
}
