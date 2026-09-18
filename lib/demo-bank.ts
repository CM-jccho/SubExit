import { foreignSamples, type Language } from "./conversation-language";
import bank from "@/data/demo-responses.json";
import type { AIOutage } from "./ai-client";
export type SampleMeta = {
  source: "sample";
  version: number;
  topic: string;
  sampleId: string;
  createdAt: string;
  outage: AIOutage;
};
export const demoCases = bank.cases;
export type SampleOperation = "partner" | "companion" | "suggestions" | "coach";
// Use the confirmed purpose as well as situation when choosing an authored example.
export function practiceSampleContext(context?: {
  title: string;
  situation: string;
  goal: string;
  partner?: string;
}) {
  return context
    ? [
        context.title,
        context.partner,
        context.goal,
        context.situation,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
}
export function chooseDemoCase(text: string) {
  const lower = text.toLocaleLowerCase();
  const responseScene = demoCases.find(
    (row) =>
      ["verbal-boundary", "parent-hours", "refund-pressure"].includes(row.id) &&
      row.keywords.some((k) => lower.includes(k)),
  );
  if (responseScene) return responseScene;
  // Relationship-specific examples take precedence over shared schedule words.
  if (/친구/.test(lower) && /약속|시간|일정|날짜|만나/.test(lower))
    return demoCases.find((row) => row.id === "friend-schedule")!;
  let best = demoCases.at(-1)!,
    score = 0;
  for (const row of demoCases.slice(0, -1)) {
    if (row.id === "friend-schedule") continue;
    const hits = row.keywords.filter((k) => lower.includes(k)).length;
    if (hits > score) {
      best = row;
      score = hits;
    }
  }
  return best;
}
export function sampleResponse(
  operation: SampleOperation,
  context: string,
  previous: string[],
  outage: AIOutage,
  random = Math.random,
  language: Language = "ko",
) {
  if (language !== "ko") {
    const field =
      operation === "suggestions"
        ? "suggestions"
        : previous.length
          ? "replies"
          : "openings";
    const pool = foreignSamples[language][field];
    const unused = pool.filter((text) => !previous.includes(text));
    const choices = unused.length
      ? unused
      : pool.filter((text) => text !== previous.at(-1));
    const reply =
      choices[
        Math.min(
          choices.length - 1,
          Math.max(0, Math.floor(random() * choices.length)),
        )
      ];
    const index = pool.indexOf(reply);
    return {
      source: "sample" as const,
      reply,
      terms: [],
      suggestions:
        operation === "suggestions"
          ? [...pool.slice(index), ...pool.slice(0, index)]
          : [],
      sample: {
        source: "sample" as const,
        version: 1,
        topic: language === "en" ? "영어 일반 대화" : "일본어 일반 대화",
        sampleId: `language-${language}:${field}:${index}`,
        createdAt: new Date().toISOString(),
        outage,
      },
    };
  }
  const row = chooseDemoCase(context);
  const field =
    operation === "suggestions"
      ? "suggestions"
      : operation === "coach"
        ? "hints"
        : operation === "companion"
          ? "companion"
          : previous.length
            ? "replies"
            : "openings";
  const pool = row[field];
  const unused = pool.filter((text) => !previous.includes(text));
  const choices = unused.length
    ? unused
    : pool.filter((text) => text !== previous.at(-1));
  const index = Math.min(
    choices.length - 1,
    Math.max(0, Math.floor(random() * choices.length)),
  );
  const reply = choices[index];
  const sample: SampleMeta = {
    source: "sample",
    version: bank.version,
    topic: row.title,
    sampleId: `${row.id}:${field}:${pool.indexOf(reply)}`,
    createdAt: new Date().toISOString(),
    outage,
  };
  return {
    source: "sample" as const,
    reply,
    terms: [],
    suggestions:
      field === "suggestions"
        ? [
            ...pool.slice(pool.indexOf(reply)),
            ...pool.slice(0, pool.indexOf(reply)),
          ]
        : [],
    sample,
  };
}
