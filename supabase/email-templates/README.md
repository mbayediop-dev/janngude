# E-mails personnalisés (Supabase Auth)

## Installation automatique (recommandée)

1. Créez un jeton d’accès personnel sur https://supabase.com/dashboard/account/tokens.
2. Ajoutez `SUPABASE_ACCESS_TOKEN=sbp_…` dans le fichier `.env`.
3. Lancez `npm run email:push`. Options :
   - `-- --site-url=https://votre-domaine` règle aussi le Site URL et les URL de redirection ;
   - `-- --smtp` configure l’envoi via Resend (nécessite `EMAIL_FROM` sur un domaine vérifié) ;
   - `-- --rate-limit=100` relève le quota d’e-mails par heure (sans effet avec le service intégré) ;
   - `-- --autoconfirm=on` supprime l’e-mail de confirmation à l’inscription, pour tester avec plusieurs
     comptes en développement (à remettre sur `off` en production).

## « email rate limit exceeded »

Le service d’e-mail intégré de Supabase est limité à **2 e-mails par heure** sur l’ensemble du projet,
confirmation d’inscription comprise. Deux issues : activer le SMTP Resend (quota de votre offre Resend),
ou, en développement, désactiver la confirmation d’e-mail (Authentication → Providers → Email →
*Confirm email* décoché, ou `npm run email:push -- --autoconfirm=on`).

## Installation manuelle

Pour chaque modèle, ouvrez **Authentication → Emails → Templates**, sélectionnez l’onglet
correspondant, collez l’objet et le corps HTML, puis enregistrez.

| Onglet Supabase | Fichier | Objet conseillé |
| --- | --- | --- |
| Confirm sign up | `confirm-signup.html` | Bienvenue sur Janngude : confirmez votre adresse |
| Reset password | `reset-password.html` | Réinitialisez votre mot de passe Janngude |
| Change email address | `change-email.html` | Confirmez votre nouvelle adresse Janngude |
| Magic link | `magic-link.html` | Votre lien de connexion Janngude |

Les liens pointent vers `{{ .RedirectTo }}?token_hash=…&type=…`, c’est-à-dire l’adresse
`/auth/confirm` de l’application, qui vérifie le jeton côté serveur. Ce flux fonctionne même
si le lien est ouvert dans un autre navigateur ou sur un autre appareil que celui de la demande.

## Réglages indispensables

Dans **Authentication → URL Configuration** :

- **Site URL** : l’adresse publique de l’application (ex. `https://janngude.app`, ou
  `http://localhost:3000` en développement).
- **Redirect URLs** : ajoutez `http://localhost:*/auth/**` et `https://VOTRE-DOMAINE/auth/**`
  (couvre `/auth/confirm`, `/auth/confirm/recovery` et `/auth/callback`).

## Sans domaine : envoyer via Gmail (ou Brevo)

Resend exige un domaine vérifié. Sans domaine, l’application peut envoyer tous ses e-mails
(authentification et partages) par le SMTP d’un compte Gmail :

1. Sur le compte Google : Sécurité → Validation en deux étapes (à activer) → *Mots de passe des applications* →
   créer un mot de passe pour « Janngude » (16 caractères).
2. Dans `.env` : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=vous@gmail.com`,
   `SMTP_PASS=<mot de passe d’application>`, `EMAIL_FROM=Janngude <vous@gmail.com>`, plus `SUPABASE_SECRET_KEY`.
3. Redémarrez le serveur. Limite Gmail : environ 500 e-mails par jour. Brevo (gratuit, 300/jour,
   expéditeur = une adresse vérifiée) fonctionne de la même façon avec `smtp-relay.brevo.com` et le port 587.

Pour une image professionnelle (expéditeur `bonjour@votre-domaine`, meilleure délivrabilité), un nom de
domaine (quelques euros par an) reste la bonne solution ; Resend le vérifie avec deux enregistrements DNS.

## Envoi via Resend (avec un domaine)

Le serveur d’e-mail intégré de Supabase est limité à quelques messages par heure. Pour que les
e-mails d’authentification partent via Resend, ouvrez **Project Settings → Authentication → SMTP Settings**,
activez *Enable Custom SMTP* et renseignez :

| Champ | Valeur |
| --- | --- |
| Sender email | une adresse d’un domaine vérifié chez Resend (ex. `bonjour@votre-domaine`) |
| Sender name | Janngude |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) ou `587` (TLS) |
| Username | `resend` |
| Password | votre clé API Resend (`re_…`) |

Sans domaine vérifié, Resend n’autorise que l’expéditeur `onboarding@resend.dev`, et seulement
vers l’adresse e-mail du compte Resend : indispensable d’ajouter et vérifier votre domaine
(Resend → Domains → Add domain, puis les enregistrements DNS) avant d’ouvrir l’application à d’autres étudiants.

Les e-mails applicatifs (notification quand un contenu est ajouté à l’espace d’un étudiant)
sont envoyés directement par l’application avec la clé `RESEND_API_KEY` et l’expéditeur `EMAIL_FROM` du fichier `.env`.
