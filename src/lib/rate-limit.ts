import "server-only";

const buckets = new Map<string, number[]>();

/** Limite simple en mémoire : `max` appels par `windowMs` pour une clé (IP + action). */
export function rateLimited(key: string, max = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) return true;
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}
