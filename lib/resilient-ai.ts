import type { Language } from "./conversation-language";
import {
  aiFetch,
  AIServiceError,
  connectionOutage,
  manualSample,
} from "./ai-client";
import {
  sampleResponse,
  type SampleMeta,
  type SampleOperation,
} from "./demo-bank";
export type SampledResponse = {
  source: "ai" | "sample";
  sample?: SampleMeta;
  reply: string;
  terms: string[];
  suggestions: string[];
  suggestion: string;
  reason: string;
  evidence: string;
  pattern: string;
  feedback: string;
  provider: string;
  model: string;
  latencyMs: number;
};
export async function sampledRequest(options: {
  operation: SampleOperation;
  context: string;
  previous: string[];
  url: string;
  init: RequestInit;
  manual?: boolean;
  language?: Language;
}): Promise<SampledResponse> {
  // Authored examples are opt-in only. An outage must never manufacture a reply.
  if (!options.manual) {
    try {
      const r = await aiFetch(options.url, options.init);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "입력 내용을 확인해 주세요.");
      const valid =
        options.operation === "suggestions"
          ? Array.isArray(d.suggestions) &&
            d.suggestions.length === 3 &&
            d.suggestions.every(
              (s: unknown) => typeof s === "string" && !!s.trim(),
            )
          : typeof d[options.operation === "coach" ? "suggestion" : "reply"] ===
              "string" &&
            !!d[options.operation === "coach" ? "suggestion" : "reply"].trim();
      if (!valid)
        throw new AIServiceError({ ...connectionOutage(), reason: "response" });
      return {
        reply: "",
        terms: [],
        suggestions: [],
        suggestion: "",
        reason: "",
        evidence: "",
        pattern: "",
        feedback: "",
        provider: "",
        model: "",
        latencyMs: 0,
        ...d,
        source: "ai",
      };
    } catch (e) {
      if (e instanceof SyntaxError)
        throw new AIServiceError({ ...connectionOutage(), reason: "response" });
      // In particular, preserve AbortError so canceled requests stay canceled.
      throw e;
    }
  }
  const sample = sampleResponse(
    options.operation,
    options.context,
    options.previous,
    manualSample(),
    Math.random,
    options.language,
  );
  return {
    ...sample,
    suggestion: sample.reply,
    reason:
      "사전에 준비한 일반 표현입니다. 현재 대화를 AI로 분석한 결과가 아니에요.",
    evidence: "",
    pattern: "사전 작성 샘플",
    feedback: "내 상황에 맞게 고쳐 사용해 주세요.",
    provider: "",
    model: "",
    latencyMs: 0,
  };
}
