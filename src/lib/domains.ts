/** Domaines de formation et matières suggérés (l’étudiant peut saisir les siens). */
export const DOMAINS: { name: string; subjects: string[] }[] = [
  { name: "Médecine & Santé", subjects: ["Anatomie", "Physiologie", "Biochimie", "Pharmacologie", "Sémiologie", "Santé publique"] },
  { name: "Droit", subjects: ["Droit civil", "Droit pénal", "Droit constitutionnel", "Droit des affaires", "Droit administratif", "Procédure civile"] },
  { name: "Informatique", subjects: ["Algorithmique", "Bases de données", "Réseaux", "Programmation", "Systèmes d’exploitation", "Intelligence artificielle"] },
  { name: "Économie & Gestion", subjects: ["Microéconomie", "Macroéconomie", "Comptabilité", "Marketing", "Finance d’entreprise", "Management"] },
  { name: "Sciences", subjects: ["Mathématiques", "Physique", "Chimie", "Biologie", "Statistiques", "Géologie"] },
  { name: "Ingénierie", subjects: ["Mécanique", "Électronique", "Génie civil", "Thermodynamique", "Automatique", "Matériaux"] },
  { name: "Lettres & Sciences humaines", subjects: ["Philosophie", "Histoire", "Géographie", "Sociologie", "Psychologie", "Linguistique"] },
  { name: "Langues", subjects: ["Anglais", "Français", "Espagnol", "Arabe", "Allemand", "Wolof"] },
  { name: "Lycée", subjects: ["Mathématiques", "Physique-Chimie", "SVT", "Histoire-Géographie", "Philosophie", "Français"] },
  { name: "Autre", subjects: [] },
];

export const DOMAIN_NAMES = DOMAINS.map((d) => d.name);

export function subjectsFor(domain: string) {
  return DOMAINS.find((d) => d.name === domain)?.subjects ?? [];
}
