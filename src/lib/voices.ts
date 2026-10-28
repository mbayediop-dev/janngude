/** Nombre maximal de voix personnalisées par étudiant (le compte ElevenLabs est partagé). */
export function maxVoicesPerUser() {
  const n = Number(process.env.MAX_VOICES_PER_USER);
  return Number.isFinite(n) && n > 0 ? n : 3;
}
