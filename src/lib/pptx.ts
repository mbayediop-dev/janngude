/** Extraction du texte d’un PowerPoint (.pptx) : chaque diapositive et ses notes, dans l’ordre. */
export async function extractPptx(buffer: Buffer | Uint8Array): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideNumber = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  const parts: string[] = [];
  for (const name of slideFiles) {
    const n = slideNumber(name);
    const xml = await zip.file(name)!.async("string");
    const slideText = paragraphsFromXml(xml);
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    // Les notes contiennent aussi le numéro de page : on l’ignore.
    const notes = notesFile ? paragraphsFromXml(await notesFile.async("string")).filter((p) => !/^\d+$/.test(p)) : [];
    if (!slideText.length && !notes.length) continue;
    parts.push(`## Diapositive ${n}\n\n${slideText.join("\n")}${notes.length ? `\n\nNotes : ${notes.join(" ")}` : ""}`);
  }
  return parts.join("\n\n");
}

/** Paragraphes (<a:p>) d’un XML DrawingML, en concaténant les segments de texte (<a:t>). */
export function paragraphsFromXml(xml: string): string[] {
  const out: string[] = [];
  for (const p of xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]));
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line) out.push(line);
  }
  return out;
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
    .replace(/&amp;/g, "&");
}
