/**
 * Répétition espacée, algorithme SM-2 simplifié.
 * Notes : 0 = Encore (oublié), 1 = Difficile, 2 = Bien, 3 = Facile.
 */
export type SrsState = { ease: number; interval_days: number; repetitions: number; lapses: number };

export function nextReview(state: SrsState, grade: 0 | 1 | 2 | 3, now = new Date()): SrsState & { due_at: string } {
  let { ease, interval_days: interval, repetitions, lapses } = state;
  if (grade === 0) {
    repetitions = 0;
    lapses += 1;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (repetitions === 0) interval = grade === 3 ? 2 : 1;
    else if (repetitions === 1) interval = grade === 1 ? 2 : grade === 2 ? 4 : 6;
    else interval = Math.round(interval * (grade === 1 ? 1.2 : grade === 2 ? ease : ease * 1.3));
    repetitions += 1;
    ease = Math.max(1.3, Math.min(3.0, ease + (grade === 3 ? 0.15 : grade === 2 ? 0 : -0.15)));
  }
  const due = new Date(now);
  if (interval === 0) due.setMinutes(due.getMinutes() + 10);
  else due.setDate(due.getDate() + interval);
  return { ease: Math.round(ease * 100) / 100, interval_days: interval, repetitions, lapses, due_at: due.toISOString() };
}

/** Délai lisible pour chaque note, affiché sous les boutons d’auto-évaluation. */
export function previewIntervals(state: SrsState): Record<0 | 1 | 2 | 3, string> {
  const fmt = (d: number) => (d === 0 ? "10 min" : d === 1 ? "1 jour" : d < 30 ? `${d} jours` : d < 365 ? `${Math.round(d / 30)} mois` : `${Math.round(d / 365)} an${d >= 730 ? "s" : ""}`);
  return { 0: fmt(0), 1: fmt(nextReview(state, 1).interval_days), 2: fmt(nextReview(state, 2).interval_days), 3: fmt(nextReview(state, 3).interval_days) };
}
