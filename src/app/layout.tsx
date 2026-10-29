import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const sans = Rubik({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Janngude — Révisez mieux, plus vite",
    template: "%s · Janngude",
  },
  description:
    "Déposez vos cours, obtenez les grandes lignes, un résumé, une lecture audio, des quiz et un assistant pour réviser. Partagez tout en un clic.",
  applicationName: "Janngude",
  manifest: "/manifest.webmanifest",
  // Icônes : fichiers de convention dans src/app (icon.svg, icon.png, apple-icon.png, favicon.ico), générés à partir de LogoMark.
  appleWebApp: { capable: true, title: "Janngude", statusBarStyle: "black" },
  openGraph: { type: "website", locale: "fr_FR", siteName: "Janngude" },
};

export const viewport: Viewport = {
  themeColor: "#d9f0f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-0 !shadow-float !font-sans",
            },
          }}
        />
      </body>
    </html>
  );
}
