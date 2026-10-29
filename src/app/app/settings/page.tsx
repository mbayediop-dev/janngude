import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { VoiceSettings } from "@/components/settings/voice-settings";
import { InstallAppButton } from "@/components/pwa/install-button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ttsConfigured } from "@/lib/tts";
import { maxVoicesPerUser } from "@/lib/voices";
import { Khadija } from "@/components/brand/khadija";

export const metadata: Metadata = { title: "Paramètres" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Paramètres" emoji="⚙️" description="Votre profil et votre voix pour les lectures audio." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[28px]" />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: voices } = await supabase.from("voices").select("id,name,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-6">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Votre nom apparaît sur les contenus que vous partagez.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm name={user.name} email={user.email} phone={user.phone} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Mot de passe</CardTitle>
            <CardDescription>Choisissez un nouveau mot de passe. Votre mot de passe actuel est demandé par sécurité.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm email={user.email} />
          </CardContent>
        </Card>
        <Card id="application" className="h-fit scroll-mt-6">
          <CardHeader>
            <CardTitle>Application</CardTitle>
            <CardDescription>Installez Janngude sur votre téléphone ou votre ordinateur : icône sur l’écran d’accueil, plein écran, écoute hors ligne.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Khadija pose="install" className="h-28 w-28" />
              <InstallAppButton variant="primary" showInstalled />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Mes voix</CardTitle>
          <CardDescription>Enregistrez une ou plusieurs voix (la vôtre, celle d’un proche…) et choisissez laquelle lit chaque cours ou résumé.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceSettings voices={voices ?? []} max={maxVoicesPerUser()} configured={ttsConfigured()} />
        </CardContent>
      </Card>
    </div>
  );
}
