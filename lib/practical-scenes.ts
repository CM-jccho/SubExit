import type { CompanionCharacter } from "./companions";
import type { ContextProfile, ConversationCard } from "./conversation-cards";
import type { VoiceSession } from "./voice-notebook";

export const responseFriends: CompanionCharacter[] = [
  {
    id: "custom-teacher-seowoo",
    name: "서우",
    shape: "owl",
    color: "sky",
    custom: true,
    specialty: "교사 역할 · 학부모 상담과 연락 경계",
    persona:
      "가상의 교사 역할이다. 학부모의 걱정을 먼저 확인하되 상담 시간과 공식 연락 경로를 분명하게 안내한다. 학생의 다른 개인정보를 공유하거나 결과를 확약하지 않는다. 법령과 학교 규정은 실제 확인이 필요하다고 구분한다. 코칭을 요청받으면 대화 문장을 함께 정리한다.",
  },
  {
    id: "custom-parent-jae",
    name: "재이",
    shape: "round",
    color: "peach",
    custom: true,
    specialty: "학부모 역할 · 즉시 답변을 요구하는 장면",
    persona:
      "어려운 상담을 연습하기 위한 가상 학부모 역할이다. 자녀가 걱정되어 빠른 답변을 반복해서 요청하지만, 상대가 구체적인 확인 시간과 절차를 설명하면 협의한다. 모든 학부모를 대표하지 않는다. 모욕·위협을 하지 않으며 상대의 안전한 대화 종료를 존중한다. 연습 중단이나 코칭 요청에는 즉시 역할을 풀고 도와준다.",
  },
  {
    id: "custom-staff-sol",
    name: "솔",
    shape: "rabbit",
    color: "sage",
    custom: true,
    specialty: "아르바이트생 역할 · 환불 응대와 책임자 연결",
    persona:
      "가상의 매장 아르바이트생 역할이다. 고객의 불편과 주문 내용을 확인하고 확인된 매장 안내만 설명한다. 권한 밖의 환불·보상·개인 결제를 약속하지 않는다. 폭언이 이어지면 경계를 알리고 책임자에게 도움을 요청한다. 코칭 요청에는 짧고 정중한 응대 문장을 제안한다.",
  },
  {
    id: "custom-customer-roi",
    name: "로이",
    shape: "cat",
    color: "lilac",
    custom: true,
    specialty: "고객 역할 · 규정 밖 보상을 요구하는 장면",
    persona:
      "응대 연습용 가상 고객 역할이다. 불만과 환불·추가 보상 요구를 분명하게 말하고 한 차례 재질문한다. 확인 절차와 책임자 연결이 제시되면 협의한다. 특정 고객 집단을 악인으로 묘사하지 않는다. 모욕·위협은 하지 않으며 중단 요청을 존중한다. 코칭 요청에는 역할을 풀고 대안 문장을 정리한다.",
  },
];
export type PracticalScene = {
  id: string;
  label: string;
  hook: string;
  industry: string;
  context: ContextProfile;
  actors: [CompanionCharacter, CompanionCharacter];
  lines: [string, string, string, string, string, string];
  tip: string;
};
export const practicalScenes: PracticalScene[] = [
  {
    id: "parent-hours",
    label: "교사 · 학부모 상담",
    hook: "밤 10시, 또 답변을 재촉한다면?",
    industry: "교육 · 학부모 응대",
    context: {
      title: "퇴근 후 반복 연락에 상담 시간 정하기",
      myRole: "담임 교사",
      partner: "자녀 문제로 밤에도 즉시 답변을 원하는 학부모",
      situation:
        "가상 장면: 밤 10시, 긴급 안전 문제가 아닌 학교생활 문의에 학부모가 답변을 재촉한다.",
      goal: "걱정을 확인하고 다음 상담 시간과 공식 연락 경로를 합의하기",
      boundaries:
        "항상 즉시 답변하겠다고 약속하거나 다른 학생 정보를 공개하지 않기",
      tone: "firm_polite",
    },
    actors: [responseFriends[1], responseFriends[0]],
    lines: [
      "메시지 보셨잖아요. 우리 아이 일인데 지금 바로 답해 주세요.",
      "많이 걱정되셨겠어요. 어떤 일이 있었는지 학교 상담 채널에 남겨 주시면, 내일 업무 시간에 내용을 확인하고 상담 시간을 안내드리겠습니다.",
      "내일까지 기다리라는 건가요? 잠깐 답하면 되잖아요.",
      "확인하지 않은 내용을 지금 말씀드리기는 어렵습니다. 상담은 업무 시간에 진행하고 있어요. 내일 확인한 뒤 연락드릴 수 있는 시간을 안내드려도 될까요?",
      "그럼 공식 채널에 내용을 남길게요. 연락 가능한 시간을 알려 주세요.",
      "네, 남겨 주신 내용을 확인한 뒤 상담 가능 시간을 안내드리겠습니다.",
    ],
    tip: "걱정 확인 → 연락 경계 → 다음 확인 방법. 작성된 연습 장면이며 실제 학교의 상담 절차를 확인하세요.",
  },
  {
    id: "refund-pressure",
    label: "아르바이트 · 환불 응대",
    hook: "환불에 추가 보상까지 요구한다면?",
    industry: "매장 · 고객 응대",
    context: {
      title: "규정 밖 환불·추가 보상 요구에 대응하기",
      myRole: "매장 아르바이트생",
      partner: "환불과 추가 보상을 즉시 요구하는 고객",
      situation:
        "가상 장면: 고객이 주문 불만을 말하며 직원 권한 밖의 환불과 추가 보상을 요구한다. 환불 가능 여부는 아직 확인되지 않았다.",
      goal: "불편과 주문 내용을 확인하고 권한 있는 책임자에게 연결하기",
      boundaries: "환불 가능 여부를 단정하거나 개인 돈으로 보상하지 않기",
      tone: "firm_polite",
    },
    actors: [responseFriends[3], responseFriends[2]],
    lines: [
      "마음에 안 들어요. 전액 환불하고 보상도 해주세요. 지금 결정해요.",
      "불편하셨던 점과 주문 내용을 먼저 확인하겠습니다. 어떤 부분에 문제가 있었는지 말씀해 주시겠어요?",
      "왜 자꾸 물어요? 그냥 환불해 주면 되잖아요.",
      "환불과 추가 보상은 제가 바로 확정할 수 없는 부분이라 책임자에게 확인하겠습니다. 요청하신 내용을 함께 전달해도 될까요?",
      "책임자는 언제 이야기할 수 있나요?",
      "지금 연결 가능한지 확인하겠습니다. 바로 연결이 어려우면 안내 가능한 시간과 연락 방법을 확인해 말씀드리겠습니다.",
    ],
    tip: "불편을 듣는 것과 보상을 확약하는 것은 달라요. ‘블랙 컨슈머’라는 낙인보다 구체적 요구와 처리 경과를 기록해요.",
  },
  {
    id: "verbal-boundary",
    label: "아르바이트 · 폭언 경계",
    hook: "큰소리와 인신공격이 이어진다면?",
    industry: "매장 · 고객 응대",
    context: {
      title: "폭언 상황에서 경계 알리고 도움 요청하기",
      myRole: "고객 응대를 맡은 아르바이트생",
      partner: "불만을 큰소리로 반복하는 고객",
      situation:
        "가상 장면: 지연된 주문에 대한 불만이 직원 개인을 향한 공격으로 이어진다.",
      goal: "불편을 확인하되 모욕적 표현에는 경계를 알리고 책임자 도움을 요청하기",
      boundaries: "맞대응하거나 혼자 끝까지 감당하겠다고 약속하지 않기",
      tone: "firm_polite",
    },
    actors: [responseFriends[3], responseFriends[2]],
    lines: [
      "기다린 게 얼만데요! 직원이 일을 이렇게 해도 돼요?",
      "오래 기다리셔서 불편하셨겠어요. 주문 상황을 확인해 드리겠습니다. 다만 직원 개인을 향한 공격적인 말씀은 멈춰 주세요.",
      "그럼 책임자를 불러요. 설명도 못 하겠다는 건가요?",
      "문제 확인은 도와드리겠습니다. 다만 같은 표현이 계속되면 제가 응대를 이어가기 어렵습니다. 책임자에게 상황을 전달하겠습니다.",
      "책임자와 이야기하겠습니다.",
      "네, 기다리신 내용과 요청을 함께 전달하고 연결 가능한지 확인하겠습니다.",
    ],
    tip: "공감 → 행동에 대한 경계 → 도움 요청. 위협이 있으면 대화 연습보다 현장의 안전 절차를 우선해요.",
  },
];
const date = "2026-09-16T00:00:00.000Z";
export const practicalCards: ConversationCard[] = practicalScenes.map((s) => ({
  ...s.context,
  id: `card-scene-${s.id}`,
  companionChoice: "coco",
  createdAt: date,
  updatedAt: date,
  lastUsedAt: null,
  useCount: 0,
  source: "manual",
  isSample: true,
}));
export const practicalSessions: VoiceSession[] = practicalScenes.map((s) => ({
  id: `session-scene-${s.id}`,
  title: s.context.title + " · 작성 샘플",
  kind: "practice",
  isSample: true,
  context: s.context,
  companion: s.actors[1],
  industry: s.industry,
  createdAt: date,
  updatedAt: date,
  turns: s.lines.map((text, i) => ({
    id: `scene-${s.id}-${i}`,
    role: i % 2 ? "user" : "assistant",
    text,
    terms: [],
    createdAt: date,
  })),
}));
