import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { TopNav, MobileNav } from "./nav";
import { UserMenu } from "./user-menu";

async function TopbarUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} isAdmin={user.role === "admin"} />;
}

/** Cadre sombre + panneau clair, comme une tablette posée sur la page. */
export function DarkFrame({ children, nav, user, bottom }: { children: React.ReactNode; nav?: React.ReactNode; user?: React.ReactNode; bottom?: React.ReactNode }) {
  return (
    <div className="min-h-dvh p-2 sm:p-4">
      <div className="flex min-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[32px] bg-ink sm:min-h-[calc(100dvh-2rem)] sm:rounded-[40px]">
        <header className="flex h-[68px] items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-7">
          <Logo href="/app" tone="light" className="shrink-0" />
          {nav}
          <div className="flex min-w-0 shrink-0 items-center justify-end">{user}</div>
        </header>
        <div className="relative mx-2 mb-2 flex-1 rounded-[28px] bg-paper sm:mx-3 sm:mb-3 sm:rounded-[34px]">
          <span aria-hidden className="absolute left-1/2 top-0 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-ink" />
          <main className={cn("px-4 pt-7 sm:px-8 sm:pt-10 lg:px-10", bottom ? "pb-32 md:pb-28" : "pb-28")}>
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
      {bottom}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DarkFrame
      nav={
        <Suspense>
          <TopNav />
        </Suspense>
      }
      user={
        <Suspense fallback={<span className="h-9 w-9 rounded-full bg-white/10" />}>
          <TopbarUser />
        </Suspense>
      }
      bottom={
        <Suspense>
          <MobileNav />
        </Suspense>
      }
    >
      {children}
    </DarkFrame>
  );
}
