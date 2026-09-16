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
export function chooseDemoCase(text: string) {
  const lower = text.toLocaleLowerCase();
  let best = demoCases.at(-1)!,
    score = 0;
  for (const row of demoCases.slice(0, -1)) {
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
) {
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
