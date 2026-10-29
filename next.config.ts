import type { NextConfig } from "next";

// URL publique de l’application (liens de partage, invitations, e-mails). Sur Vercel, déduite du domaine de production
// si NEXT_PUBLIC_APP_URL n’est pas définie ; en local, http://localhost:3000.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

const nextConfig: NextConfig = {
  env: appUrl ? { NEXT_PUBLIC_APP_URL: appUrl } : {},
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["unpdf", "mammoth", "@react-pdf/renderer"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
