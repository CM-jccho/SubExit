import type { ConversationCard } from "./conversation-cards";
export const FOCUS_KEY = "ddeundeun-conversation-focus-v1";
export const focusOptions = [
  {
    id: "work",
    label: "직장 업무",
    example: "동료에게 부탁 · 일정과 업무 범위 조율",
    cardIds: [
      "card-sample-request-work",
      "card-sample-deadline",
      "card-sample-scope",
    ],
    companionIds: ["dundi", "moa"],
    termGroups: ["product", "people", "it"],
  },
  {
    id: "service",
    label: "고객 응대",
    example: "환불 요청 · 무리한 요구에 선 긋기",
    cardIds: ["card-scene-refund-pressure", "card-scene-verbal-boundary"],
    companionIds: ["coco"],
    termGroups: ["service", "sales", "food"],
  },
  {
    id: "education",
    label: "학부모 상담",
    example: "상담 시간 정하기 · 반복 연락에 대응",
    cardIds: ["card-scene-parent-hours"],
    companionIds: ["coco"],
    termGroups: ["education", "school"],
  },
  {
    id: "daily",
    label: "친구와 가족",
    example: "약속 변경 · 편하게 부탁하고 거절하기",
    cardIds: ["card-sample-request-friend"],
    companionIds: ["tori"],
    termGroups: ["teen", "school", "gaming"],
  },
  {
    id: "custom",
    label: "내 상황",
    example: "직접 설명한 상황으로 준비하기",
    cardIds: [],
    companionIds: ["dundi"],
    termGroups: [],
  },
] as const;
export type ConversationFocus = (typeof focusOptions)[number]["id"] | "all";
export function parseFocus(raw: string | null): ConversationFocus | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data?.version === 1 &&
      (data.focus === "all" || focusOptions.some((x) => x.id === data.focus))
      ? data.focus
      : null;
  } catch {
    return null;
  }
}
export function focusInfo(focus: ConversationFocus | null) {
  return focusOptions.find((x) => x.id === focus);
}
export function curatedCards(
  cards: ConversationCard[],
  focus: ConversationFocus | null,
) {
  const ids: readonly string[] = focusInfo(focus)?.cardIds || [];
  return cards.filter(
    (c) => !c.isSample || focus === "all" || ids.includes(c.id),
  );
}
