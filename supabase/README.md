# Base de données Supabase

1. Ouvrez votre projet Supabase → **SQL Editor** → **New query**.
2. Collez le contenu de `migrations/0001_init.sql` et exécutez-le, puis faites de même, **dans l’ordre**, avec chaque migration suivante : `0002_audio_sources.sql` (lectures des grandes lignes et points à retenir), `0003_voices.sql` (plusieurs voix par étudiant), `0004_features.sql` (cartes mémoire, examens, groupes, recherche, suivi d’usage, rôles, accueil), `0005_phone_search.sql` (téléphone sur le profil, recherche d’étudiants pour le partage). Les scripts sont idempotents.
3. Dans **Authentication → URL Configuration**, ajoutez `http://localhost:3000/auth/callback`
   (et l’URL de production) dans *Redirect URLs*.
4. (Optionnel) **Authentication → Providers → Email** : désactivez *Confirm email*
   pour permettre la connexion immédiate après inscription en développement.

Le script crée :

- les tables `profiles`, `courses`, `summaries`, `quizzes`, `quiz_attempts`, `audio_readings`,
  `chats`, `chat_messages`, `shares`, `share_recipients` avec RLS (chaque étudiant ne voit que ses données) ;
- les buckets `courses` (privé), `audio` (public, chemins aléatoires) et `voices` (privé) ;
- les fonctions `get_share`, `grade_shared_quiz`, `save_share`, `list_received_shares`
  qui permettent la consultation d’un partage sans compte.
