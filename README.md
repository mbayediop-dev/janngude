# Janngude

Espace de révision pour étudiants : déposez un cours (PDF, Word, PowerPoint, texte, photo de notes, enregistrement audio ou vidéo YouTube, un ou plusieurs fichiers à la fois), classé par **formation** et **matière**, et obtenez :

- les **grandes lignes** et les **informations à retenir** (dès le dépôt), sous forme de post-it ;
- des **résumés** à la demande (court, standard, détaillé) avec export **PDF** ;
- une **lecture audio** MP3 du cours, d’un résumé, des grandes lignes ou des points à retenir, en **narration naturelle** (script oral avec pauses et respirations, voix expressive Eleven v4, en français, anglais ou wolof) ou en lecture fidèle, ou en **podcast à deux voix**, avec la **voix par défaut** ou **vos propres voix** ; lecteur synchronisé (sous-titres, texte, sommaire, recherche), reprise de lecture et **écoute hors ligne** (PWA) ;
- des **quiz** à choix multiples, corrigés et expliqués après l’épreuve, et des **examens blancs chronométrés** sur plusieurs cours ;
- des **cartes mémoire** à répétition espacée (révisions du jour) ;
- une **discussion** avec un assistant qui connaît le cours ;
- une **recherche globale** dans le contenu de tous les cours ;
- le **partage** de tout cela, y compris d’un **cours complet** (lien public, WhatsApp, PDF, MP3, ajout direct dans l’espace d’un autre étudiant), consultable **avec ou sans compte**, des **groupes de classe** (code d’invitation, partage de contenus depuis la page du groupe, classement des quiz), et la **reprise d’une discussion partagée** dans son espace pour poser ses propres questions à l’assistant ;
- un **espace administrateur** (`/admin`) : statistiques, consommation IA et voix, quota ElevenLabs, gestion des comptes.

## Pile technique

- Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript, Tailwind CSS v4, police Rubik, design « tablette » pastel (cadre sombre + panneau clair)
- Supabase : authentification, PostgreSQL (RLS), Storage
- Claude (Anthropic SDK) : analyse, résumés, quiz, cartes, examens, discussion, narration, podcast, transcription des scans
- ElevenLabs : synthèse vocale (horodatée), clonage de voix, reconnaissance vocale (notes audio)
- `@react-pdf/renderer` : exports PDF · `unpdf` / `mammoth` / `jszip` : extraction de texte (PDF, Word, PowerPoint) · `youtube-transcript` : sous-titres YouTube

## Mise en route

1. **Dépendances**
   ```bash
   npm install
   ```
2. **Variables d’environnement** — copiez `.env.example` vers `.env` et renseignez :
   | Clé | Rôle |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publique Supabase |
   | `ANTHROPIC_API_KEY` | clé API Claude (analyse, résumés, quiz, chat) |
   | `NEXT_ILEVENLABS_KEY` | clé ElevenLabs (lecture MP3, voix personnalisée) |
   | `ELEVENLABS_DEFAULT_VOICE_ID` | voix par défaut (identifiant d’une voix de votre bibliothèque) |
   | `ELEVENLABS_MODEL` | modèle de synthèse (défaut `eleven_v4`) |
   | `ELEVENLABS_PODCAST_VOICE_ID` | voix de l’invité des podcasts à deux voix |
   | `SUPABASE_SECRET_KEY` | clé secrète Supabase : e-mails d’authentification envoyés par l’application, suppression de comptes depuis `/admin` |
   | `SMTP_*` ou `RESEND_API_KEY` | envoi des e-mails (authentification et notifications de partage) |
   | `NEXT_PUBLIC_APP_URL` | URL publique (liens de partage, invitations de groupe) |
3. **Base de données** — exécutez **dans l’ordre** les scripts de `supabase/migrations/` (`0001` → `0004`) dans l’éditeur SQL de Supabase (voir `supabase/README.md`), puis ajoutez `http://localhost:*/auth/**` dans *Authentication → URL Configuration → Redirect URLs*.
4. **E-mails personnalisés** — collez les modèles de `supabase/email-templates/` dans *Authentication → Emails → Templates* (voir le README de ce dossier), ou `npm run email:push`.
5. **Premier administrateur** — après votre première connexion, dans l’éditeur SQL :
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'vous@exemple.com');
   ```
   L’entrée « Administration » apparaît ensuite dans le menu du compte ; les autres administrateurs se nomment depuis `/admin`.
6. **Lancer**
   ```bash
   npm run dev
   ```

## Déploiement sur Vercel

1. **Importer le dépôt** sur [vercel.com/new](https://vercel.com/new) (GitHub `mbayediop-dev/janngude`, framework détecté : Next.js, aucune commande à changer).
2. **Variables d’environnement** (Settings → Environment Variables, pour Production et Preview) : toutes celles de `.env.example` sauf `NEXT_PUBLIC_APP_URL`, déduite automatiquement du domaine Vercel. Obligatoires : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_ILEVENLABS_KEY`, `SUPABASE_SECRET_KEY` ; e-mails : `RESEND_API_KEY` + `EMAIL_FROM` (domaine vérifié chez Resend) ou `SMTP_*`.
3. **Supabase → Authentication → URL Configuration** : *Site URL* = `https://<projet>.vercel.app`, *Redirect URLs* : `https://<projet>.vercel.app/auth/**` et `https://*-<équipe>.vercel.app/auth/**` pour les déploiements de prévisualisation.
4. **Limites à connaître** : les fonctions durent au plus 300 s (narration + synthèse d’un cours de 20 000 caractères tient dans ce délai) ; les fichiers de cours et les échantillons de voix sont envoyés directement à Supabase Storage par le navigateur, jamais via les fonctions (limite Vercel de 4,5 Mo par requête). L’offre Hobby de Vercel est réservée à un usage non commercial : passez en Pro avant d’ouvrir des abonnements payants.
5. Chaque `git push` sur `main` redéploie la production ; les autres branches créent une prévisualisation.

## Commandes

```bash
npm run dev     # serveur de développement
npm run build   # build de production
npm run lint    # ESLint
npx tsc --noEmit
```

## Organisation

```
src/app/                  pages (App Router)
  page.tsx                accueil public
  (auth)/                 connexion, inscription, mot de passe
  app/                    espace personnel (cours, révisions, examens, groupes, partagés avec moi, recherche, paramètres)
  admin/                  espace administrateur
  s/[token]/              consultation publique d’un partage
  api/                    routes serveur (analyse, import YouTube, résumés, quiz, cartes, examens, chat, audio, voix, partages, groupes, admin, PDF)
src/components/           UI, coquille de l’app, panneaux du cours, lecteur audio, cartes, examens, groupes, partage, admin, paramètres
src/lib/ai/               appels Claude (prompts, analyse, résumé, quiz, cartes, chat, transcription, narration, podcast)
src/lib/tts.ts            ElevenLabs (synthèse horodatée, clonage, reconnaissance vocale)
src/lib/extract.ts        extraction de texte (PDF, Word, PowerPoint, images, audio)
src/lib/offline.ts        écoute hors ligne (Cache API) · public/sw.js, public/offline.html
src/lib/pdf/              documents PDF
src/lib/supabase/         clients et types
supabase/migrations/      schéma SQL (tables, RLS, buckets, fonctions de partage, groupes, admin)
```
