import { Database, ExternalLink } from "lucide-react";

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.replace(/^https?:\/\//, "").split(".")[0];
}

/** Affiché quand les tables Supabase n’existent pas encore (script SQL non appliqué). */
export function SetupNotice() {
  const ref = projectRef();
  const sqlEditor = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard";
  return (
    <div className="rounded-[28px] bg-lemon p-7 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80 text-ink">
          <Database className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">La base de données n’est pas encore initialisée</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Les tables, les buckets de stockage et les fonctions de partage sont créés par le script <code className="rounded-md bg-white/70 px-1.5 py-0.5 text-[13px]">supabase/migrations/0001_init.sql</code>. Exécutez-le une fois dans l’éditeur SQL de votre projet Supabase, puis rechargez cette page.
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[15px] text-ink-2">
            <li>Ouvrez l’éditeur SQL de votre projet et collez le contenu du script.</li>
            <li>Cliquez sur « Run » : le script est ré-exécutable sans risque.</li>
            <li>Dans Authentication → URL Configuration, ajoutez l’adresse de retour <code className="rounded-md bg-white/70 px-1.5 py-0.5 text-[13px]">/auth/callback</code> de votre site.</li>
          </ol>
          <a
            href={sqlEditor}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-black"
          >
            Ouvrir l’éditeur SQL <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
