/** Normalise un numéro saisi librement : chiffres et « + » initial, indicatif du Sénégal ajouté aux numéros locaux à 9 chiffres. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (input.trim().startsWith("00")) digits = digits.slice(2);
  const hadPlus = input.trim().startsWith("+") || input.trim().startsWith("00");
  if (!hadPlus && digits.length === 9 && /^7[05-8]/.test(digits)) digits = `221${digits}`; // mobile sénégalais sans indicatif
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Affichage lisible : +221 77 123 45 67. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const m = value.match(/^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return value; // autres pays : la longueur de l’indicatif varie, on affiche le numéro tel quel
}

export function isValidPhone(input: string) {
  return normalizePhone(input) !== null;
}
