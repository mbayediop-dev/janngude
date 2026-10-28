import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { QuizQuestion, OutlineSection, KeyPoint } from "@/lib/supabase/types";

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontFamily: "Helvetica", fontSize: 10.5, color: "#16211c", lineHeight: 1.5 },
  brand: { position: "absolute", top: 24, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: "#6b746f" },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8.5, color: "#6b746f" },
  eyebrow: { fontSize: 9, color: "#0f6e56", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  title: { fontFamily: "Times-Roman", fontSize: 24, marginBottom: 4, lineHeight: 1.2 },
  subtitle: { fontSize: 10, color: "#6b746f", marginBottom: 18 },
  h2: { fontFamily: "Times-Roman", fontSize: 15, marginTop: 14, marginBottom: 6 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 6 },
  li: { flexDirection: "row", marginBottom: 3, paddingLeft: 6 },
  bullet: { width: 12 },
  question: { marginTop: 12, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  option: { flexDirection: "row", marginBottom: 2, paddingLeft: 10 },
  explanation: { marginTop: 4, marginLeft: 10, padding: 6, backgroundColor: "#e2f0ea", borderRadius: 4, color: "#0a4a3a", fontSize: 9.5 },
  message: { marginBottom: 10, padding: 8, borderRadius: 6 },
  user: { backgroundColor: "#f1efe9" },
  assistant: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e6e3db" },
  role: { fontSize: 8.5, color: "#6b746f", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#e6e3db", marginVertical: 8 },
});

type Meta = { eyebrow: string; title: string; subtitle: string; author: string; date: string };

function Frame({ meta, children }: { meta: Meta; children: React.ReactNode }) {
  return (
    <Document title={meta.title} author={meta.author} producer="Janngude" creator="Janngude">
      <Page size="A4" style={styles.page}>
        <View style={styles.brand} fixed>
          <Text>Janngude</Text>
          <Text>{meta.author}</Text>
        </View>
        <Text style={styles.eyebrow}>{meta.eyebrow}</Text>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.subtitle}>{meta.subtitle}</Text>
        {children}
        <View style={styles.footer} fixed>
          <Text>{meta.date}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// --- Markdown minimal → blocs PDF -------------------------------------------
function inline(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|\s)\*(.*?)\*(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function MarkdownBlocks({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const nodes: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flush = () => {
    if (paragraph.length) {
      nodes.push(
        <Text key={key++} style={styles.p}>
          {inline(paragraph.join(" "))}
        </Text>,
      );
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      nodes.push(
        <Text key={key++} style={h[1].length <= 2 ? styles.h2 : styles.h3}>
          {inline(h[2])}
        </Text>,
      );
      continue;
    }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /^\s*\d+/.test(line);
      const n = ordered ? line.match(/^\s*(\d+)/)?.[1] + "." : "•";
      nodes.push(
        <View key={key++} style={styles.li}>
          <Text style={styles.bullet}>{n}</Text>
          <Text style={{ flex: 1 }}>{inline(li[1])}</Text>
        </View>,
      );
      continue;
    }
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flush();
      nodes.push(<View key={key++} style={styles.hr} />);
      continue;
    }
    if (/^\|/.test(line)) {
      if (/^\|?[\s:-]+\|[\s|:-]*$/.test(line)) continue;
      flush();
      nodes.push(
        <Text key={key++} style={styles.p}>
          {inline(line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).join("  ·  "))}
        </Text>,
      );
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return <>{nodes}</>;
}

export async function renderSummaryPdf(input: { title: string; course: string; domain: string; subject: string; content: string; author: string; date: string }) {
  const meta: Meta = { eyebrow: "Résumé de cours", title: input.title, subtitle: `${input.course} · ${input.domain} — ${input.subject}`, author: input.author, date: input.date };
  return renderToBuffer(
    <Frame meta={meta}>
      <MarkdownBlocks content={input.content} />
    </Frame>,
  );
}

export async function renderQuizPdf(input: {
  title: string;
  course: string;
  domain: string;
  subject: string;
  questions: QuizQuestion[];
  withAnswers: boolean;
  author: string;
  date: string;
}) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const meta: Meta = {
    eyebrow: input.withAnswers ? "Quiz — avec corrigé" : "Quiz",
    title: input.title,
    subtitle: `${input.course} · ${input.domain} — ${input.subject} · ${input.questions.length} questions`,
    author: input.author,
    date: input.date,
  };
  return renderToBuffer(
    <Frame meta={meta}>
      {input.questions.map((q, i) => (
        <View key={i} wrap={false}>
          <Text style={styles.question}>
            {i + 1}. {q.question}
          </Text>
          {q.options.map((o, j) => (
            <View key={j} style={styles.option}>
              <Text style={styles.bullet}>{letters[j]}.</Text>
              <Text style={{ flex: 1 }}>
                {o}
                {input.withAnswers && j === q.answer_index ? "  ✓" : ""}
              </Text>
            </View>
          ))}
          {input.withAnswers ? (
            <Text style={styles.explanation}>
              Réponse : {letters[q.answer_index]}. {q.explanation}
            </Text>
          ) : null}
        </View>
      ))}
    </Frame>,
  );
}

export async function renderCoursePdf(input: {
  title: string;
  domain: string;
  subject: string;
  overview: string | null;
  outline: OutlineSection[];
  keyPoints: KeyPoint[];
  keywords: string[];
  author: string;
  date: string;
}) {
  const meta: Meta = { eyebrow: "Fiche de cours", title: input.title, subtitle: `${input.domain} — ${input.subject}`, author: input.author, date: input.date };
  return renderToBuffer(
    <Frame meta={meta}>
      {input.overview ? (
        <>
          <Text style={styles.h2}>En bref</Text>
          <Text style={styles.p}>{input.overview}</Text>
        </>
      ) : null}
      {input.keywords.length ? <Text style={[styles.p, { color: "#6b746f" }]}>Mots-clés : {input.keywords.join(" · ")}</Text> : null}
      {input.outline.length ? <Text style={styles.h2}>Grandes lignes</Text> : null}
      {input.outline.map((s, i) => (
        <View key={i} wrap={false}>
          <Text style={styles.h3}>
            {i + 1}. {s.title}
          </Text>
          {s.points.map((p, j) => (
            <View key={j} style={styles.li}>
              <Text style={styles.bullet}>•</Text>
              <Text style={{ flex: 1 }}>{p}</Text>
            </View>
          ))}
        </View>
      ))}
      {input.keyPoints.length ? <Text style={styles.h2}>À retenir</Text> : null}
      {input.keyPoints.map((k, i) => (
        <View key={i} style={styles.explanation} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{k.title}</Text>
          <Text>{k.detail}</Text>
        </View>
      ))}
    </Frame>,
  );
}

export async function renderChatPdf(input: {
  title: string;
  course: string;
  domain: string;
  subject: string;
  messages: { role: "user" | "assistant"; content: string }[];
  author: string;
  date: string;
}) {
  const meta: Meta = { eyebrow: "Discussion", title: input.title, subtitle: `${input.course} · ${input.domain} — ${input.subject}`, author: input.author, date: input.date };
  return renderToBuffer(
    <Frame meta={meta}>
      {input.messages.map((m, i) => (
        <View key={i} style={[styles.message, m.role === "user" ? styles.user : styles.assistant]}>
          <Text style={styles.role}>{m.role === "user" ? "Étudiant" : "Assistant"}</Text>
          <MarkdownBlocks content={m.content} />
        </View>
      ))}
    </Frame>,
  );
}
