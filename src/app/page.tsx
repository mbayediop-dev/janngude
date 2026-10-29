import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Headphones, ListChecks, MessagesSquare, Share2, ListTree, UploadCloud, Sparkles, ShieldCheck, GraduationCap, Inbox, Settings, Search, Play } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Khadija, KhadijaFigure } from "@/components/brand/khadija";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { InstallAppButton } from "@/components/pwa/install-button";
import { getCurrentUser } from "@/lib/auth";

const FEATURES = [
  { icon: ListTree, bg: "bg-mint", title: "Grandes lignes et points clés", text: "Dès le dépôt, la structure du cours et les informations à retenir : définitions, formules, dates, règles, exceptions." },
  { icon: FileText, bg: "bg-sky", title: "Résumés à la demande", text: "Court, standard ou détaillé, avec une consigne si besoin. Export PDF propre, prêt à imprimer." },
  { icon: Headphones, bg: "bg-pink", title: "Lecture audio, avec votre voix", text: "Écoutez le cours ou un résumé en MP3, lu par la voix par défaut ou par votre propre voix enregistrée en une minute." },
  { icon: ListChecks, bg: "bg-lemon", title: "Quiz corrigés", text: "Des questions à choix multiples sur l’ensemble du cours, le niveau de votre choix, les bonnes réponses et leurs explications après l’épreuve." },
  { icon: MessagesSquare, bg: "bg-lavender", title: "Khadija, l’assistante qui connaît le cours", text: "Posez toutes vos questions : Khadija répond à partir du contenu du cours et vous propose de vérifier votre compréhension." },
  { icon: Share2, bg: "bg-violet", title: "Partage en un clic", text: "Lien, WhatsApp, PDF ou MP3 : partagez un quiz, un résumé, une lecture ou une discussion, à des étudiants avec ou sans compte." },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh p-2 sm:p-4">
      <div className="overflow-hidden rounded-[32px] bg-ink sm:rounded-[40px]">
        {/* Barre sombre */}
        <header className="flex h-[76px] items-center justify-between gap-3 px-4 sm:px-7">
          <Logo tone="light" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
            {[
              ["#fonctionnalites", "Fonctionnalités"],
              ["#comment", "Comment ça marche"],
              ["#partage", "Partage"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 text-[15px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <Suspense fallback={<Skeleton className="h-10 w-40 rounded-full bg-white/10" />}>
            <HeaderActions />
          </Suspense>
        </header>

        {/* Panneau clair */}
        <div className="relative mx-2 mb-2 rounded-[28px] bg-paper sm:mx-3 sm:mb-3 sm:rounded-[34px]">
          <span aria-hidden className="absolute left-1/2 top-0 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-ink" />
          <main>
            {/* Hero */}
            <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:pt-20">
              <div className="animate-rise">
                <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[13px] font-medium text-ink shadow-card">
                  <Sparkles className="h-4 w-4" /> Votre espace de révision personnel
                </span>
                <h1 className="mt-6 text-[42px] font-semibold leading-[1.02] tracking-tight text-ink text-balance sm:text-[60px]">
                  Déposez votre cours. <br />
                  Révisez l’essentiel. <span className="align-middle">🎓</span>
                </h1>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
                  Janngude lit vos cours, PDF, Word ou photos de notes, et en tire les grandes lignes, les informations à retenir, des résumés, une lecture audio avec votre voix, des quiz corrigés et Khadija, votre assistante, qui répond à vos questions.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/signup">
                      Créer mon espace gratuit <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/login">J’ai déjà un compte</Link>
                  </Button>
                  <InstallAppButton variant="ghost" size="lg" label="Installer l’application" className="max-w-full" />
                </div>
                <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
                  <ShieldCheck className="h-4 w-4" /> Vos cours restent privés. Vous choisissez ce que vous partagez.
                </p>
              </div>

              {/* Aperçu produit */}
              <ProductPreview />
            </section>

            {/* Fonctionnalités */}
            <section id="fonctionnalites" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
              <div className="max-w-2xl">
                <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-ink sm:text-[44px]">Tout ce qu’il faut pour maîtriser un cours ✨</h2>
                <p className="mt-3 text-[16px] text-ink-2">Chaque fonctionnalité se lance à la demande, cours par cours, dans un espace classé par formation et par matière.</p>
              </div>
              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f) => (
                  <div key={f.title} className={`relative rounded-[28px] p-7 transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-float ${f.bg}`}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-ink">
                      <f.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-6 text-[20px] font-semibold leading-tight text-ink">{f.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{f.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Comment ça marche */}
            <section id="comment" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
              <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-ink sm:text-[44px]">Trois étapes, et vous révisez</h2>
              <ol className="mt-12 grid gap-5 md:grid-cols-3">
                {[
                  { icon: UploadCloud, pose: "upload" as const, title: "Déposez", text: "Choisissez la formation et la matière, puis déposez votre cours (PDF, Word, texte ou photo de vos notes)." },
                  { icon: Sparkles, pose: "study" as const, title: "Laissez l’analyse se faire", text: "En quelques instants, votre espace affiche les grandes lignes et les informations à retenir." },
                  { icon: ListChecks, pose: "headphones" as const, title: "Révisez à votre façon", text: "Résumé, écoute, quiz ou questions à Khadija : chaque outil se lance quand vous en avez besoin." },
                ].map((s, i) => (
                  <li key={s.title} className="rounded-[28px] bg-surface p-7 shadow-card">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[44px] font-semibold leading-none tracking-tight text-line-strong">{String(i + 1).padStart(2, "0")}</span>
                      <Khadija pose={s.pose} className="-mr-3 -mt-4 h-28 w-28" />
                    </div>
                    <h3 className="mt-4 flex items-center gap-2 text-[20px] font-semibold text-ink">
                      <s.icon className="h-5 w-5" /> {s.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.text}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Partage */}
            <section id="partage" className="mx-auto w-full max-w-6xl px-5 pb-20 pt-4 sm:px-8">
              <div className="overflow-hidden rounded-[32px] bg-ink px-8 py-12 text-white sm:px-12 sm:py-16">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
                  <div>
                    <Khadija pose="friends" className="mb-4 h-36 w-36" />
                    <h2 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[42px]">Révisez à plusieurs, sans contrainte 🤝</h2>
                    <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/75">
                      Un camarade sans compte ouvre votre quiz depuis WhatsApp et obtient son score. Un étudiant inscrit retrouve vos résumés dans sa rubrique « Partagés avec moi ». Les PDF et MP3 se téléchargent en un clic.
                    </p>
                    <Button asChild size="lg" variant="white" className="mt-8">
                      <Link href="/signup">
                        Commencer maintenant <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <ul className="grid gap-3 text-[15px] sm:grid-cols-2">
                    {[
                      ["Lien de consultation public", "bg-mint"],
                      ["Envoi WhatsApp en un clic", "bg-sky"],
                      ["Résumés et quiz en PDF", "bg-lemon"],
                      ["Lectures audio en MP3", "bg-pink"],
                      ["Discussions partageables", "bg-lavender"],
                      ["Ajout direct dans l’espace d’un étudiant", "bg-violet"],
                    ].map(([t, bg]) => (
                      <li key={t} className={`rounded-[20px] px-4 py-3 font-medium text-ink ${bg}`}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 pb-10 text-[13px] text-muted sm:flex-row sm:px-8">
              <Logo compact />
              <p>Janngude, réviser mieux, plus vite.</p>
              <div className="flex gap-5">
                <Link href="/login" className="hover:text-ink">
                  Connexion
                </Link>
                <Link href="/signup" className="hover:text-ink">
                  Inscription
                </Link>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative animate-rise [animation-delay:120ms]">
      <div className="overflow-hidden rounded-[30px] bg-ink p-2 shadow-pop">
        <div className="flex items-center justify-between px-4 py-3 text-white">
          <span className="text-[15px] font-semibold">Janngude</span>
          <span className="flex items-center gap-3 text-white/70">
            <GraduationCap className="h-4 w-4 text-white" />
            <Inbox className="h-4 w-4" />
            <Settings className="h-4 w-4" />
          </span>
          <span className="flex items-center gap-2 text-[12px]">
            <span className="h-6 w-6 rounded-full bg-mint" /> Aminata
          </span>
        </div>
        <div className="rounded-[24px] bg-paper p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[18px] font-semibold tracking-tight text-ink">Mon plan d’apprentissage 🎓</p>
            <span className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] text-muted">
              <Search className="h-3 w-3" /> Rechercher
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["26", "Total", "bg-sky"],
              ["18", "Prêts", "bg-mint"],
              ["8", "En analyse", "border-2 border-dashed border-line-strong"],
            ].map(([v, l, bg]) => (
              <div key={l} className={`rounded-2xl px-2 py-3 text-center ${bg}`}>
                <p className="text-[20px] font-semibold leading-none text-ink">{v}</p>
                <p className="mt-1 text-[10px] text-ink-2/80">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="relative rounded-[22px] bg-violet p-4 sm:-rotate-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-2/70">Droit civil</p>
              <p className="mt-1 text-[16px] font-semibold leading-tight text-ink">La responsabilité civile</p>
              <p className="mt-2 text-[11px] leading-snug text-ink/80">Conditions, fait générateur, lien de causalité, réparation du préjudice.</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-medium text-ink">Écoute · 12:30</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
                  <Play className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
            <div className="relative rounded-[22px] bg-surface p-4 shadow-card">
              <span className="absolute -right-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-mint text-ink shadow-card">
                <ListTree className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-2/70">Anatomie</p>
              <p className="mt-1 text-[16px] font-semibold leading-tight text-ink">Le système nerveux</p>
              <p className="mt-2 text-[11px] leading-snug text-ink-2/80">Organisation, neurones, transmission du signal.</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-mint px-2.5 py-1 text-[10px] font-medium text-primary-ink">Prêt 👏</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <div className="flex items-center gap-1.5 rounded-full bg-ink p-1.5">
              {["bg-violet", "bg-sky", "bg-pink", "bg-lemon", "bg-mint"].map((c) => (
                <span key={c} className={`h-7 w-7 rounded-full ${c}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Khadija, la mascotte */}
      <div className="relative z-10 -mt-6 ml-1 max-w-md sm:-ml-8 lg:-ml-14">
        <KhadijaFigure layout="row" pose="laptop" size="md" bubbleClassName="shadow-float">
          Moi, c’est Khadija ! Je lis vos cours et je réponds à vos questions, à toute heure.
        </KhadijaFigure>
      </div>
    </div>
  );
}

async function HeaderActions() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Button asChild variant="white" size="sm">
        <Link href="/app">
          Mon espace <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className="hidden rounded-full px-4 py-2 text-[15px] font-medium text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex">
        Se connecter
      </Link>
      <Button asChild variant="white" size="sm">
        <Link href="/signup">Créer un compte</Link>
      </Button>
    </div>
  );
}
