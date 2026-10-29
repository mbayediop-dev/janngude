"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Download, Share, Smartphone, Monitor, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { INSTALL_SERVER_SNAPSHOT, installSnapshot, parseInstallSnapshot, promptInstall, subscribeInstall, type InstallPlatform } from "@/lib/install";

const STEPS: Record<InstallPlatform, { title: string; icon: React.ComponentType<{ className?: string }>; steps: string[]; note?: string }> = {
  ios: {
    title: "Sur iPhone ou iPad (Safari)",
    icon: Share,
    steps: ["Touchez le bouton Partager de Safari (le carré avec une flèche vers le haut).", "Choisissez « Sur l’écran d’accueil ».", "Touchez « Ajouter » : l’icône Janngude apparaît avec vos applications."],
    note: "Depuis Chrome sur iPhone, utilisez le même menu Partager.",
  },
  android: {
    title: "Sur Android (Chrome)",
    icon: Smartphone,
    steps: ["Ouvrez le menu ⋮ en haut à droite de Chrome.", "Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».", "Confirmez : Janngude s’ouvre ensuite en plein écran, comme une application."],
  },
  desktop: {
    title: "Sur ordinateur",
    icon: Monitor,
    steps: ["Chrome ou Edge : cliquez sur l’icône d’installation à droite de la barre d’adresse, puis « Installer ».", "Safari (macOS) : menu Fichier → « Ajouter au Dock ».", "Janngude s’ouvre alors dans sa propre fenêtre, avec une icône dans le Dock ou la barre des tâches."],
    note: "Firefox ne propose pas l’installation : utilisez Chrome, Edge ou Safari.",
  },
};

/** Bouton « Installer l’application » : invite native quand le navigateur la propose, sinon instructions adaptées à l’appareil. */
export function InstallAppButton({ variant = "secondary", size = "md", className, label = "Installer l’application", showInstalled = false }: { variant?: "primary" | "secondary" | "outline" | "ghost" | "white"; size?: "sm" | "md" | "lg"; className?: string; label?: string; showInstalled?: boolean }) {
  const snapshot = useSyncExternalStore(subscribeInstall, installSnapshot, () => INSTALL_SERVER_SNAPSHOT);
  const { canPrompt, installed, platform } = parseInstallSnapshot(snapshot);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (installed) {
    return showInstalled ? (
      <p className={`inline-flex items-center gap-2 text-sm text-ink-2 ${className ?? ""}`}>
        <CheckCircle2 className="h-4 w-4 text-success" /> Application installée sur cet appareil.
      </p>
    ) : null;
  }

  async function onClick() {
    if (canPrompt) {
      setBusy(true);
      try {
        const result = await promptInstall();
        if (result === "accepted") toast.success("Janngude s’installe : retrouvez-la avec vos applications.");
        else if (result === "unavailable") setOpen(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setOpen(true);
  }

  const order: InstallPlatform[] = [platform, ...(["ios", "android", "desktop"] as InstallPlatform[]).filter((p) => p !== platform)];

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={onClick} loading={busy}>
        <Download className="h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Installer Janngude" description="Gratuit, sans boutique d’applications : l’application s’ajoute à votre téléphone ou à votre ordinateur en quelques secondes, et l’écoute hors ligne devient disponible.">
          <div className="space-y-3">
            {order.map((p, i) => {
              const s = STEPS[p];
              return (
                <section key={p} className={`rounded-[22px] p-4 ${i === 0 ? "bg-mint/60" : "bg-surface-2"}`}>
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                    <s.icon className="h-4 w-4" /> {s.title}
                    {i === 0 ? <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-ink-2">votre appareil</span> : null}
                  </h3>
                  <ol className="mt-2 space-y-1.5 text-[14px] text-ink-2">
                    {s.steps.map((step, k) => (
                      <li key={k} className="flex gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">{k + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {s.note ? <p className="mt-2 text-[12px] text-muted">{s.note}</p> : null}
                </section>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
