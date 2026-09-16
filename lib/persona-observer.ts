import { parseCompanion, type CompanionCharacter } from "./companions";
export type ObservedTurn = { speaker: 0 | 1; text: string };
export function observerInput(d: unknown) {
  const v = d as { topic?: unknown; characters?: unknown[] };
  if (
    !v ||
    typeof v.topic !== "string" ||
    !v.topic.trim() ||
    v.topic.length > 400 ||
    !Array.isArray(v.characters) ||
    v.characters.length !== 2
  )
    throw new Error("두 친구와 400자 이내의 주제를 선택해 주세요.");
  const characters = v.characters.map(parseCompanion) as [
    CompanionCharacter,
    CompanionCharacter,
  ];
  if (characters[0].id === characters[1].id)
    throw new Error("서로 다른 두 친구를 선택해 주세요.");
  return { topic: v.topic.trim(), characters };
}
export function validateObservedTurns(v: unknown): ObservedTurn[] {
  if (
    !Array.isArray(v) ||
    v.length !== 6 ||
    v.some(
      (t, i) =>
        !t ||
        t.speaker !== i % 2 ||
        typeof t.text !== "string" ||
        !t.text.trim() ||
        t.text.length > 700,
    )
  )
    throw new Error("invalid_output");
  return v.map((t) => ({ speaker: t.speaker, text: t.text.trim() }));
}
