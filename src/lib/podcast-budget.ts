/**
 * Budget de longueur du podcast à deux voix. Le dialogue est écrit par Claude à partir du cours complet,
 * puis synthétisé : il doit donc rester nettement sous la limite de synthèse vocale (`TTS_MAX_CHARS`, 20 000 par
 * défaut), quelle que soit la longueur du cours. Module sans dépendance serveur : utilisé par l’onglet Écoute
 * (estimation affichée) et par la génération.
 */

/** Longueur maximale du texte de cours transmis à Claude pour écrire le dialogue. */
export const PODCAST_INPUT_MAX_CHARS = 250_000;

export type PodcastBudget = {
  /** Longueur visée du dialogue (toutes répliques réunies). */
  target: number;
  /** Filet de sécurité : au-delà, les dernières répliques des sections les plus longues sont retirées. */
  hard: number;
  /** Durée d’écoute estimée (≈ 900 caractères par minute). */
  minutes: number;
  /** Vrai quand le cours est trop long pour être repris en entier : le dialogue le condense. */
  condensed: boolean;
};

export function podcastBudget(courseChars: number, ttsLimit: number): PodcastBudget {
  const cap = Math.max(1_000, Math.min(15_000, Math.floor(ttsLimit * 0.75)));
  const natural = Math.round(Math.max(0, courseChars) * 1.2);
  const target = Math.min(cap, Math.max(Math.min(2_500, cap), natural));
  const hard = Math.max(target, Math.min(ttsLimit - 500, Math.round(cap * 1.25)));
  return { target, hard, minutes: Math.max(1, Math.round(target / 900)), condensed: natural > cap };
}
