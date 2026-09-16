import { isCompanionChoice, type CompanionChoice } from "./companions";
import type { Tone } from "./scenarios";
export type ContextProfile = {
  title: string;
  myRole: string;
  partner: string;
  situation: string;
  goal: string;
  boundaries: string;
  tone: Tone;
};
export type ConversationCard = ContextProfile & {
  companion?: CompanionChoice;
  id: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  useCount: number;
  source: "guided" | "ai" | "manual";
  isSample?: boolean;
};
export type SetupMessage = { role: "user" | "assistant"; text: string };
export const CARD_KEY = "ddeundeun-conversation-cards-v1";
export const emptyProfile = (): ContextProfile => ({
  title: "",
  myRole: "",
  partner: "",
  situation: "",
  goal: "",
  boundaries: "",
  tone: "firm_polite",
});
const limits = {
  title: 60,
  myRole: 120,
  partner: 160,
  situation: 800,
  goal: 400,
  boundaries: 400,
};
export const profileSchema = {
  type: "object",
  properties: {
    ...Object.fromEntries(
      Object.keys(limits).map((k) => [k, { type: "string" }]),
    ),
    tone: { type: "string", enum: ["firm_polite", "warm", "cold"] },
  },
  required: [...Object.keys(limits), "tone"],
  additionalProperties: false,
};
export function parseProfile(input: unknown, complete = true): ContextProfile {
  if (!input || typeof input !== "object") throw new Error("invalid_context");
  const d = input as Record<string, unknown>,
    result: Record<string, string> = {};
  for (const [k, max] of Object.entries(limits)) {
    if (typeof d[k] !== "string" || d[k].length > max)
      throw new Error("invalid_context");
    result[k] = d[k].trim();
  }
  if (!["firm_polite", "warm", "cold"].includes(String(d.tone)))
    throw new Error("invalid_context");
  if (
    complete &&
    (!result.title || !result.partner || !result.situation || !result.goal)
  )
    throw new Error("incomplete_context");
  return { ...result, tone: d.tone } as ContextProfile;
}
export function parseCards(raw: string | null): ConversationCard[] {
  try {
    const data = JSON.parse(raw || "{}");
    if (data.version !== 1 || !Array.isArray(data.cards)) return [];
    const out = new Map<string, ConversationCard>();
    for (const c of data.cards.slice(0, 100)) {
      try {
        const p = parseProfile(c);
        if (
          typeof c.id !== "string" ||
          !/^card-[a-zA-Z0-9-]{1,70}$/.test(c.id) ||
          !Number.isFinite(Date.parse(c.createdAt)) ||
          !Number.isFinite(Date.parse(c.updatedAt))
        )
          continue;
        out.set(c.id, {
          ...p,
          id: c.id,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          lastUsedAt:
            typeof c.lastUsedAt === "string" &&
            Number.isFinite(Date.parse(c.lastUsedAt))
              ? c.lastUsedAt
              : null,
          useCount:
            Number.isInteger(c.useCount) && c.useCount >= 0
              ? Math.min(c.useCount, 100000)
              : 0,
          source: ["guided", "ai", "manual"].includes(c.source)
            ? c.source
            : "manual",
          ...(c.isSample === true ? { isSample: true } : {}),
          ...(isCompanionChoice(c.companion) ? { companion: c.companion } : {}),
        });
      } catch {}
    }
    return [...out.values()];
  } catch {
    return [];
  }
}
export function readCards() {
  try {
    return parseCards(localStorage.getItem(CARD_KEY));
  } catch {
    return [];
  }
}
export function writeCards(
  cards: ConversationCard[],
  requestSamplesInitialized?: boolean,
  practicalSamplesInitialized?: boolean,
) {
  if (cards.length > 100)
    throw new Error("카드는 최대 100개까지 저장할 수 있어요.");
  const previous = JSON.parse(localStorage.getItem(CARD_KEY) || "null");
  localStorage.setItem(
    CARD_KEY,
    JSON.stringify({
      version: 1,
      samplesInitialized: true,
      requestSamplesInitialized:
        requestSamplesInitialized ??
        previous?.requestSamplesInitialized === true,
      practicalSamplesInitialized:
        practicalSamplesInitialized ??
        previous?.practicalSamplesInitialized === true,
      cards,
    }),
  );
}
export function saveCard(
  profile: ContextProfile,
  source: ConversationCard["source"],
  existingId?: string,
  companion?: CompanionChoice,
): ConversationCard[] {
  const clean = parseProfile(profile),
    cards = readCards(),
    old = cards.find((c) => c.id === existingId),
    now = new Date().toISOString();
  const card: ConversationCard = {
    ...clean,
    id: old?.id || "card-" + crypto.randomUUID(),
    createdAt: old?.createdAt || now,
    updatedAt: now,
    lastUsedAt: old?.lastUsedAt || null,
    useCount: old?.useCount || 0,
    source,
    companion: isCompanionChoice(companion)
      ? companion
      : old?.companion || "auto",
    ...(old?.isSample ? { isSample: true } : {}),
  };
  const next = [card, ...cards.filter((c) => c.id !== card.id)];
  writeCards(next);
  return next;
}
export function searchCards(cards: ConversationCard[], query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return cards
    .filter((c) =>
      words.every((w) =>
        [c.title, c.myRole, c.partner, c.situation, c.goal, c.boundaries]
          .join(" ")
          .toLocaleLowerCase()
          .includes(w),
      ),
    )
    .sort((a, b) =>
      (b.lastUsedAt || b.updatedAt).localeCompare(a.lastUsedAt || a.updatedAt),
    );
}
export function markUsed(id: string) {
  const next = readCards().map((c) =>
    c.id === id
      ? { ...c, useCount: c.useCount + 1, lastUsedAt: new Date().toISOString() }
      : c,
  );
  writeCards(next);
  return next;
}
export const exampleProfile: ContextProfile = {
  title: "마감을 조율하는 대화",
  myRole: "실무 담당자",
  partner: "업무를 요청한 팀장",
  situation: "기존 업무가 남아 있는데 금요일까지 추가 보고서를 요청받았다.",
  goal: "우선순위를 합의하고 추가 보고서 마감을 다음 주로 조율하기",
  boundaries: "기존 업무를 숨기지 않기. 주말 작업을 약속하지 않기.",
  tone: "firm_polite",
};
export function guidedReply(messages: SetupMessage[]): {
  profile: ContextProfile;
  question: string;
} {
  const a = messages.filter((m) => m.role === "user").map((m) => m.text.trim());
  const p = emptyProfile();
  p.situation = (a[0] || "").slice(0, 800);
  p.title = (a[0] || "").slice(0, 32);
  p.partner = (a[1] || "").slice(0, 160);
  p.goal = (a[2] || "").slice(0, 400);
  p.boundaries = (a[3] || "").slice(0, 400);
  p.myRole = "";
  const questions = [
    "누구와 어떤 이야기를 하려 하나요? 정해진 유형 없이 편하게 적어주세요.",
    "그 대화의 상대를 어떻게 부를까요? 실명 대신 관계나 역할로 알려주세요.",
    "이번 대화가 끝났을 때, 어떤 결과를 얻고 싶으세요?",
    "꼭 지킬 선이나 피하고 싶은 약속이 있나요? 없다면 “없어요”라고 적어주세요.",
  ];
  return {
    profile: p,
    question:
      questions[a.length] ||
      "말씀하신 내용을 카드로 정리했어요. 제목과 내용을 확인하고 저장해 주세요.",
  };
}
