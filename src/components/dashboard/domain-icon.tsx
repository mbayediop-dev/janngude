import { BookOpen, Stethoscope, Scale, Code2, LineChart, FlaskConical, Cog, Feather, Languages, School } from "lucide-react";

const MAP: { match: RegExp; icon: React.ComponentType<{ className?: string }> }[] = [
  { match: /m[ée]decine|sant[ée]|pharma|infirm/i, icon: Stethoscope },
  { match: /droit|juri/i, icon: Scale },
  { match: /informati|dev|logiciel|data|r[ée]seau/i, icon: Code2 },
  { match: /[ée]conomi|gestion|finance|compta|marketing|commerce/i, icon: LineChart },
  { match: /science|physique|chimie|bio|math/i, icon: FlaskConical },
  { match: /ing[ée]ni|m[ée]cani|[ée]lectro|g[ée]nie/i, icon: Cog },
  { match: /lettre|philo|histoire|socio|psycho|humaine/i, icon: Feather },
  { match: /langue|anglais|fran[cç]ais|espagnol|arabe/i, icon: Languages },
  { match: /lyc[ée]e|coll[èe]ge|bac/i, icon: School },
];

export function DomainIcon({ domain, className }: { domain: string; className?: string }) {
  const Icon = MAP.find((m) => m.match.test(domain))?.icon ?? BookOpen;
  return <Icon className={className} />;
}
