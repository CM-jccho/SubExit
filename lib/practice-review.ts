import { parseProfile, type ContextProfile } from "./conversation-cards";
import type { VoiceSession, VoiceTurn } from "./voice-notebook";
export type ReviewPoint = { turnId: string; quote: string; note: string };
export type PracticeReview = {
  strength: ReviewPoint;
  improvement: ReviewPoint & { rewrite: string };
  focus: string;
  sourceKey: string;
  createdAt: string;
};
export function reviewKey(context: ContextProfile, turns: VoiceTurn[]) {
  return JSON.stringify([
    parseProfile(context),
    turns.map((t) => [t.id, t.role, t.text]),
  ]);
}
export function validateReview(
  raw: unknown,
  context: ContextProfile,
  turns: VoiceTurn[],
): PracticeReview {
  const r = raw as Record<string, unknown>;
  function point(value: unknown): ReviewPoint {
    const p = value as ReviewPoint;
    if (
      !p ||
      typeof p.turnId !== "string" ||
      typeof p.quote !== "string" ||
      !p.quote.trim() ||
      p.quote.length > 500 ||
      typeof p.note !== "string" ||
      !p.note.trim() ||
      p.note.length > 600
    )
      throw new Error("invalid_output");
    const turn = turns.find((t) => t.id === p.turnId && t.role === "user");
    if (!turn || !turn.text.includes(p.quote))
      throw new Error("ungrounded_output");
    return { turnId: p.turnId, quote: p.quote, note: p.note.trim() };
  }
  const strength = point(r?.strength),
    improvement = point(r?.improvement);
  const rewrite = (r.improvement as { rewrite?: unknown })?.rewrite;
  if (
    typeof rewrite !== "string" ||
    !rewrite.trim() ||
    rewrite.length > 800 ||
    typeof r.focus !== "string" ||
    !r.focus.trim() ||
    r.focus.length > 300
  )
    throw new Error("invalid_output");
  return {
    strength,
    improvement: { ...improvement, rewrite: rewrite.trim() },
    focus: r.focus.trim(),
    sourceKey: reviewKey(context, turns),
    createdAt: new Date().toISOString(),
  };
}
export function reviewDrill(
  session: VoiceSession,
  review: PracticeReview,
): VoiceSession {
  if (
    !session.context ||
    review.sourceKey !== reviewKey(session.context, session.turns)
  )
    throw new Error("먼저 현재 대화를 복기해 주세요.");
  const i = session.turns.findIndex(
    (t) => t.id === review.improvement.turnId && t.role === "user",
  );
  const previous = session.turns[i - 1];
  if (!previous || previous.role !== "assistant")
    throw new Error("다시 연습할 상대의 말을 찾지 못했어요.");
  const now = new Date().toISOString();
  return {
    id: "session-" + crypto.randomUUID(),
    kind: "practice",
    gardenRootId:
      session.gardenRootId ||
      session.practicePlan?.sourceSessionId ||
      session.id,
    gardenRetryOriginal: session.turns[i].text,
    title: session.context.title + " · 다시 연습",
    context: { ...session.context },
    companion: session.companion,
    industry: session.industry,
    languages: session.languages,
    // Retain the actual preceding exchange so the partner can understand references.
    turns: session.turns.slice(0, i).map((t) => ({
      id: "turn-" + crypto.randomUUID(),
      role: t.role,
      text: t.text,
      terms: [...t.terms],
      ...(t.sample ? { sample: t.sample } : {}),
      ...(t.origin ? { origin: t.origin } : {}),
      createdAt: now,
    })),
    practicePlan: {
      focus: review.focus,
      sourceSessionId: session.id,
      carriedTurns: i,
    },
    createdAt: now,
    updatedAt: now,
  };
}
