export const messengerRelations = [
  "직장 동료",
  "상사",
  "고객·거래처",
  "친구",
  "가족",
] as const;
export const messengerIntents = [
  "내용 확인하기",
  "정중하게 거절하기",
  "부탁하기",
  "일정 조율하기",
  "오해 풀기",
] as const;
export const messengerTones = ["부드럽게", "간결하게", "단호하게"] as const;
export type MessengerInput = {
  message: string;
  relation: string;
  intent: string;
  goal: string;
  boundary: string;
};
export type MessengerCandidate = { tone: string; text: string; note: string };
export type MessengerRecord = {
  version: 1;
  input: MessengerInput;
  candidates: MessengerCandidate[];
  source: "ai" | "sample" | "manual";
  draft: string;
  draftSource?: "ai" | "sample" | "manual";
  selectedTone?: string;
  updatedAt: string;
};
export const blankMessenger: MessengerInput = {
  message: "",
  relation: "직장 동료",
  intent: "내용 확인하기",
  goal: "",
  boundary: "",
};
export function parseMessengerInput(d: unknown): MessengerInput {
  const v = d as MessengerInput;
  if (
    !v ||
    typeof v.message !== "string" ||
    v.message.trim().length < 2 ||
    v.message.length > 4000 ||
    !messengerRelations.some((x) => x === v.relation) ||
    !messengerIntents.some((x) => x === v.intent) ||
    typeof v.goal !== "string" ||
    v.goal.trim().length < 2 ||
    v.goal.length > 500 ||
    typeof v.boundary !== "string" ||
    v.boundary.length > 500
  )
    throw Error(
      "상대 메시지와 내 의도를 입력해 주세요. 메시지는 2~4,000자, 목표는 2~500자예요.",
    );
  return {
    message: v.message.trim(),
    relation: v.relation,
    intent: v.intent,
    goal: v.goal.trim(),
    boundary: v.boundary.trim(),
  };
}
export function messengerKey(d: MessengerInput) {
  return JSON.stringify([
    d.message.trim(),
    d.relation,
    d.intent,
    d.goal.trim(),
    d.boundary.trim(),
  ]);
}
export function parseMessengerCandidates(d: unknown): MessengerCandidate[] {
  if (!Array.isArray(d) || d.length !== 3) throw Error("invalid_output");
  return messengerTones.map((tone) => {
    const v = d.find((c) => c?.tone === tone);
    if (
      !v ||
      typeof v.text !== "string" ||
      v.text.trim().length < 2 ||
      v.text.length > 1000 ||
      typeof v.note !== "string" ||
      !v.note.trim() ||
      v.note.length > 300
    )
      throw Error("invalid_output");
    return { tone, text: v.text.trim(), note: v.note.trim() };
  });
}
export const messengerExamples: {
  id: string;
  title: string;
  input: MessengerInput;
  candidates: MessengerCandidate[];
}[] = [
  {
    id: "deadline",
    title: "업무 마감 조율",
    input: {
      message: "이 자료도 오늘 중으로 정리해주실 수 있나요?",
      relation: "상사",
      intent: "일정 조율하기",
      goal: "기존 업무와 새 자료의 우선순위를 확인하기",
      boundary: "오늘 완료할 수 있다고 미리 약속하지 않기",
    },
    candidates: [
      {
        tone: "부드럽게",
        text: "요청 주신 자료 확인했습니다. 진행 중인 업무와 일정이 겹쳐 우선순위를 먼저 여쭤보고 싶습니다. 어느 작업부터 진행하면 좋을까요?",
        note: "요청을 확인한 뒤 우선순위를 물어요.",
      },
      {
        tone: "간결하게",
        text: "진행 중인 업무와 겹쳐 우선순위 확인이 필요합니다. 어느 작업부터 진행할까요?",
        note: "확인할 핵심만 짧게 전달해요.",
      },
      {
        tone: "단호하게",
        text: "현재 작업과 겹쳐 오늘 완료를 바로 약속드리기는 어렵습니다. 우선순위를 정해주시면 가능한 일정을 확인하겠습니다.",
        note: "확정할 수 없는 약속에 선을 긋고 다음 행동을 제안해요.",
      },
    ],
  },
  {
    id: "friend",
    title: "친구의 부탁 거절",
    input: {
      message: "이번 주말에 이사하는데 하루 종일 도와줄 수 있어?",
      relation: "친구",
      intent: "정중하게 거절하기",
      goal: "이번 주말에는 도와주기 어렵다고 말하기",
      boundary: "다른 날짜나 도움을 약속하지 않기",
    },
    candidates: [
      {
        tone: "부드럽게",
        text: "이사 준비하느라 바쁘겠다. 도와주고 싶지만 이번 주말에는 어려울 것 같아.",
        note: "부탁을 받아주면서 가능한 범위를 전해요.",
      },
      {
        tone: "간결하게",
        text: "이번 주말에는 이사를 도와주기 어려워.",
        note: "가능 여부를 짧게 말해요.",
      },
      {
        tone: "단호하게",
        text: "이번 주말에는 도와줄 수 없어. 가능하다고 약속하기는 어려워.",
        note: "추가 약속 없이 거절 의사를 분명히 해요.",
      },
    ],
  },
  {
    id: "review",
    title: "동료에게 검토 부탁",
    input: {
      message: "자료 초안 나왔나요? 확인할 부분 있으면 알려주세요.",
      relation: "직장 동료",
      intent: "부탁하기",
      goal: "자료의 설명 순서를 검토받고 가능한 시간을 확인하기",
      boundary: "급한 마감이나 검토 시간을 임의로 정하지 않기",
    },
    candidates: [
      {
        tone: "부드럽게",
        text: "확인해 주신다니 감사합니다. 자료의 설명 순서가 자연스러운지 봐주실 수 있을까요? 편하신 시간을 알려주시면 맞춰보겠습니다.",
        note: "검토할 부분과 가능한 시간을 함께 물어요.",
      },
      {
        tone: "간결하게",
        text: "자료의 설명 순서를 검토 부탁드립니다. 가능하신 시간을 알려주실 수 있을까요?",
        note: "요청 범위를 구체적으로 짧게 적어요.",
      },
      {
        tone: "단호하게",
        text: "이번에는 자료의 설명 순서를 중심으로 검토받고 싶습니다. 검토 가능한 시간을 알려주세요.",
        note: "검토 범위를 분명하게 정해 전달해요.",
      },
    ],
  },
];
