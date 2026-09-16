import {
  CARD_KEY,
  exampleProfile,
  parseCards,
  readCards,
  writeCards,
  type ConversationCard,
} from "./conversation-cards";
import {
  seedNotebook,
  type TermNote,
  type VoiceSession,
} from "./voice-notebook";
const date = "2026-01-01T00:00:00.000Z";
export const starterCards: ConversationCard[] = [
  {
    ...exampleProfile,
    id: "card-sample-deadline",
    title: "팀장님과 마감 조율",
    createdAt: date,
    updatedAt: date,
    lastUsedAt: null,
    useCount: 0,
    source: "manual",
    isSample: true,
  },
  {
    id: "card-sample-scope",
    title: "거래처와 작업 범위 정하기",
    myRole: "디자인 실무 담당자",
    partner: "추가 수정을 요청한 거래처 담당자",
    situation: "합의한 시안 외에 화면 세 개의 추가 디자인을 요청받았다.",
    goal: "추가 작업의 범위와 일정, 비용을 먼저 합의하기",
    boundaries: "확인하지 않은 납기나 무료 작업을 약속하지 않기",
    tone: "firm_polite",
    createdAt: date,
    updatedAt: date,
    lastUsedAt: null,
    useCount: 0,
    source: "manual",
    isSample: true,
  },
];
export const starterSession: VoiceSession = {
  id: "session-sample-deadline",
  title: "마감 조율은 이렇게 말해요",
  kind: "practice",
  isSample: true,
  context: { ...exampleProfile },
  industry: "IT · 서비스 기획",
  createdAt: date,
  updatedAt: date,
  turns: [
    {
      role: "assistant",
      text: "보고서, 금요일까지 가능할까요? 이번 스프린트 안에 공유하면 좋겠어요.",
      terms: ["스프린트"],
    },
    {
      role: "user",
      text: "기존 업무를 마치려면 시간이 더 필요해요. 추가 보고서의 스코프를 먼저 정하고, 다음 주까지로 조율할 수 있을까요?",
      terms: ["스코프"],
    },
    {
      role: "assistant",
      text: "좋아요. 이번에는 핵심 지표만 정리하고, 상세 분석은 백로그에 남겨둘까요?",
      terms: ["백로그"],
    },
    {
      role: "user",
      text: "네, 핵심 지표를 정리한 보고서는 다음 주 월요일에 공유하겠습니다. 상세 분석 일정은 현재 업무를 확인한 뒤 따로 말씀드릴게요.",
      terms: [],
    },
  ].map((t, i) => ({
    ...t,
    role: t.role as "user" | "assistant",
    id: "turn-sample-" + i,
    createdAt: date,
  })),
};
export const starterTerms: TermNote[] = [
  {
    term: "스코프",
    meaning:
      "이번 작업에서 어디까지 할지 합의한 범위예요. 포함할 일과 제외할 일을 함께 정해요.",
    usage: "이번 보고서의 스코프는 핵심 지표 요약까지로 정할까요?",
    caution: "범위만 정하지 말고 일정·결과물·승인 기준도 함께 확인해요.",
    memo: "예시 팀 메모: 추가 요청이 오면 포함 범위부터 다시 확인하기.",
  },
  {
    term: "스프린트",
    meaning:
      "팀이 목표한 일을 수행하고 결과를 점검하는 일정한 길이의 작업 기간을 말해요.",
    usage: "이번 스프린트에서는 핵심 지표 정리를 마무리해요.",
    caution: "실제 기간과 운영 방식은 팀마다 다르니 확인해요.",
    memo: "예시 팀 메모: 시작할 때 목표와 맡을 일을 함께 확인하기.",
  },
  {
    term: "백로그",
    meaning: "앞으로 해야 할 일을 모으고 우선순위를 정하는 목록이에요.",
    usage: "상세 분석은 백로그에 남기고 다음 일정에서 논의할게요.",
    caution: "목록에 넣었다고 일정이나 담당자가 확정된 것은 아니에요.",
    memo: "예시 팀 메모: 담당자와 다시 검토할 날짜를 덧붙이기.",
  },
].map((t, i) => ({
  ...t,
  id: "term-sample-" + i,
  industry: "IT · 서비스 기획",
  quote: "",
  sessionId: starterSession.id,
  source: "manual",
  reviewed: false,
  updatedAt: date,
  isSample: true,
}));
export function seedCards(restore = false) {
  const raw = localStorage.getItem(CARD_KEY);
  // Never overwrite data we cannot understand, including data from a future app version.
  if (raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        "기존 카드 데이터를 읽지 못했어요. 데이터는 그대로 보관했어요.",
      );
    }
    if (data?.version !== 1 || !Array.isArray(data.cards))
      throw new Error(
        "기존 카드 형식을 확인해야 해요. 데이터는 그대로 보관했어요.",
      );
    if (data.samplesInitialized && !restore) return readCards();
    if (parseCards(raw).length !== data.cards.length)
      throw new Error(
        "일부 카드를 읽지 못해 샘플 추가를 멈췄어요. 기존 데이터는 그대로 보관했어요.",
      );
  }
  const old = readCards();
  const additions = starterCards
    .filter((c) => !old.some((o) => o.id === c.id))
    .slice(0, Math.max(0, 100 - old.length));
  const next = [...old, ...additions];
  writeCards(next);
  return next;
}
export async function seedStarterData(restore = false) {
  const cards = seedCards(restore);
  await seedNotebook([starterSession], starterTerms, restore);
  return cards;
}
