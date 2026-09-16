import type { VoiceSession } from "./voice-notebook";
import { reviewKey, reviewDrill } from "./practice-review";
export type TrainingSkill = "associate" | "followup" | "clarity";
export const trainingSkills = [
  {
    id: "associate",
    title: "생각 넓히기",
    description: "소재 하나에서 경험·취향·질문으로 가지를 뻗어요.",
    method: "눈에 보이는 소재 → 떠오르는 경험이나 취향 → 상대에게 건넬 질문",
    checkpoints: [
      "소재와 내 이야기가 이어지나요?",
      "경험이 없다면 궁금한 점으로 바꿔도 좋아요.",
      "상대가 답할 여지가 있는 질문인가요?",
    ],
  },
  {
    id: "followup",
    title: "질문 이어가기",
    description: "상대 말의 단서 하나를 잡아 이야기를 이어가요.",
    method: "상대 말에서 단서 고르기 → 짧게 받아주기 → 질문 하나만 건네기",
    checkpoints: [
      "상대가 실제로 말한 단서를 골랐나요?",
      "숨은 감정이나 이유를 단정하지 않았나요?",
      "한 번에 하나를 물었나요?",
    ],
  },
  {
    id: "clarity",
    title: "핵심 전달",
    description: "핵심·이유·요청을 나눠 짧고 분명하게 전해요.",
    method: "전할 핵심 → 필요한 이유 → 상대가 답할 수 있는 요청",
    checkpoints: [
      "가장 전할 말이 앞에 있나요?",
      "없는 사실이나 약속을 덧붙이지 않았나요?",
      "상대에게 바라는 행동이 구체적인가요?",
    ],
  },
] as const;
export type TrainingExercise = {
  id: string;
  skill: TrainingSkill;
  title: string;
  context: string;
  labels: [string, string, string];
  hints: [string, string, string];
  example: [string, string, string];
  level: "시작" | "응용";
};
export const trainingExercises: TrainingExercise[] = [
  {
    id: "a-lunch",
    skill: "associate",
    title: "점심으로 말문 열기",
    level: "시작",
    context:
      "점심 메뉴를 기다리며 동료와 가볍게 이야기하려고 해요. 소재는 ‘점심’이에요.",
    labels: [
      "떠오르는 경험이나 취향",
      "그 이야기와 이어지는 소재",
      "상대에게 건넬 질문",
    ],
    hints: [
      "익숙한 메뉴, 새로운 메뉴, 함께 먹은 기억 중 골라보세요.",
      "장소·취향·경험으로 한 걸음만 넓혀보세요.",
      "내 이야기를 길게 끝내기보다 상대의 이야기를 열어보세요.",
    ],
    example: [
      "저는 익숙한 메뉴를 자주 골라요.",
      "가끔은 새로운 메뉴도 먹어보고 싶어요.",
      "요즘 괜찮았던 점심 메뉴가 있어요?",
    ],
  },
  {
    id: "a-rain",
    skill: "associate",
    title: "비 오는 날의 한마디",
    level: "시작",
    context: "소재는 ‘비’예요. 날씨에서 취향이나 일상 이야기로 이어보세요.",
    labels: [
      "떠오르는 경험이나 취향",
      "그 이야기와 이어지는 소재",
      "상대에게 건넬 질문",
    ],
    hints: [
      "소리·음식·산책처럼 편한 소재를 골라요.",
      "관련된 내 취향 하나면 충분해요.",
      "상대도 다른 취향을 말할 수 있게 물어봐요.",
    ],
    example: [
      "빗소리를 들으면 차가 생각나요.",
      "따뜻한 음료를 마시며 쉬고 싶어져요.",
      "비 오는 날 즐기는 게 있어요?",
    ],
  },
  {
    id: "a-team",
    skill: "associate",
    title: "새 동료와 공통점 찾기",
    level: "응용",
    context:
      "처음 만난 동료와 ‘출근길’에서 시작해 대화를 넓혀보세요. 집 주소처럼 자세한 개인정보를 물을 필요는 없어요.",
    labels: [
      "떠오르는 경험이나 취향",
      "그 이야기와 이어지는 소재",
      "상대에게 건넬 질문",
    ],
    hints: [
      "출근길에 보거나 듣는 것을 떠올려요.",
      "음악·책·쉬는 시간으로 이어볼 수 있어요.",
      "정확한 거주지보다 편한 취향을 물어봐요.",
    ],
    example: [
      "이동할 때 음악을 듣는 편이에요.",
      "새로운 노래를 알게 되면 즐거워요.",
      "요즘 자주 듣는 노래가 있어요?",
    ],
  },
  {
    id: "q-walk",
    skill: "followup",
    title: "산책 이야기 이어가기",
    level: "시작",
    context: "상대: “주말에 공원을 걸었는데 사람이 적어서 좋았어요.”",
    labels: ["상대 말에서 고른 단서", "짧게 받아주는 말", "이어지는 질문 하나"],
    hints: [
      "상대 문장에서 단어를 그대로 골라도 좋아요.",
      "말하지 않은 감정은 단정하지 않아요.",
      "장소·경험·취향 중 하나만 물어봐요.",
    ],
    example: [
      "사람이 적어서",
      "한적한 곳을 걸으셨군요.",
      "산책할 곳을 고를 때 어떤 점을 보세요?",
    ],
  },
  {
    id: "q-hobby",
    skill: "followup",
    title: "새 취미에 관심 보이기",
    level: "시작",
    context: "상대: “요즘 도자기를 배우는데 모양 잡기가 어렵더라고요.”",
    labels: ["상대 말에서 고른 단서", "짧게 받아주는 말", "이어지는 질문 하나"],
    hints: [
      "배운다는 점이나 어려운 부분 중 하나를 골라요.",
      "바로 해결책을 주기 전에 들은 말을 받아줘요.",
      "한꺼번에 여러 가지를 묻지 않아요.",
    ],
    example: [
      "모양 잡기가 어렵다",
      "모양을 잡는 과정이 쉽지 않군요.",
      "어떤 모양을 만들어보고 싶으세요?",
    ],
  },
  {
    id: "q-work",
    skill: "followup",
    title: "막연한 업무 요청 좁히기",
    level: "응용",
    context:
      "상대: “자료를 좀 더 보기 좋게 바꿔주실 수 있나요?” 일정·분량·수정 범위는 아직 정하지 않았어요.",
    labels: [
      "상대 말에서 고른 단서",
      "짧게 받아주는 말",
      "먼저 확인할 질문 하나",
    ],
    hints: [
      "모호한 표현 하나를 찾아요.",
      "수정 의도를 확인하겠다고 받아줘요.",
      "범위부터 물어볼지 우선순위부터 물어볼지 골라요.",
    ],
    example: [
      "보기 좋게",
      "자료를 더 읽기 쉽게 정리하고 싶으시군요.",
      "어느 부분을 먼저 바꾸면 좋을까요?",
    ],
  },
  {
    id: "c-request",
    skill: "clarity",
    title: "동료에게 검토 부탁하기",
    level: "시작",
    context:
      "제안서의 흐름을 동료에게 검토받고 싶어요. 동료가 가능한 시간은 모르고, 급한 마감도 정해져 있지 않아요.",
    labels: ["가장 전하고 싶은 핵심", "필요한 이유", "상대에게 바라는 요청"],
    hints: [
      "검토를 부탁한다는 핵심부터 써요.",
      "이번 검토에서 확인할 것을 설명해요.",
      "가능한 시간을 물으며 선택할 여지를 둬요.",
    ],
    example: [
      "제안서 흐름을 한번 검토해 주실 수 있을까요?",
      "설명 순서가 읽기 쉬운지 확인하고 싶어요.",
      "편하실 때 봐주실 수 있는지 알려주세요.",
    ],
  },
  {
    id: "c-plan",
    skill: "clarity",
    title: "친구와 약속 다시 정하기",
    level: "시작",
    context:
      "약속 시간을 바꾸고 싶지만 새 시간은 아직 정하지 않았어요. 가상 상황에서 변경 이유를 스스로 정해도 좋아요.",
    labels: ["가장 전하고 싶은 핵심", "필요한 이유", "함께 정할 요청"],
    hints: [
      "시간을 바꾸고 싶다는 말을 앞에 둬요.",
      "가상 연습용으로 짧은 이유를 적어요.",
      "새 시간을 일방적으로 확정하지 않아요.",
    ],
    example: [
      "우리 약속 시간을 다시 정할 수 있을까?",
      "예상하지 못한 일정이 생겨서 조정이 필요해.",
      "네가 가능한 시간을 알려주면 같이 맞춰보고 싶어.",
    ],
  },
  {
    id: "c-priority",
    skill: "clarity",
    title: "추가 업무의 우선순위 확인",
    level: "응용",
    context:
      "기존 보고서와 새로 요청받은 자료 작업이 겹쳐요. 두 일을 모두 오늘 마칠 수 있는지는 아직 확인하지 못했어요.",
    labels: [
      "가장 전하고 싶은 핵심",
      "확인이 필요한 이유",
      "합의하고 싶은 요청",
    ],
    hints: [
      "우선순위 조율이 필요함을 말해요.",
      "확실하지 않은 완료 시점을 약속하지 않아요.",
      "무엇을 먼저 할지 답할 수 있게 물어요.",
    ],
    example: [
      "두 작업의 우선순위를 확인하고 싶습니다.",
      "기존 보고서와 새 자료 작업이 겹쳐 오늘 모두 마칠 수 있는지 확인이 필요합니다.",
      "어느 작업부터 진행하면 좋을까요?",
    ],
  },
];
export const findTraining = (id: unknown) =>
  trainingExercises.find((e) => e.id === id);
export type TrainingFeedback = {
  quote: string;
  note: string;
  nextAction: string;
  source: "ai";
  createdAt: string;
};
export type TrainingOrigin = {
  sessionId: string;
  sourceKey: string;
  quote: string;
  focus: string;
};
export type TrainingRecord = {
  version: 1;
  exerciseId: string;
  answers: string[];
  revised?: string[];
  completedAt?: string;
  feedback?: TrainingFeedback;
  origin?: TrainingOrigin;
};
export function validTrainingAnswers(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (v) => typeof v === "string" && v.trim().length >= 2 && v.length <= 600,
    )
  );
}
export function validateTrainingFeedback(
  value: unknown,
  answers: string[],
): TrainingFeedback {
  const d = value as Record<string, unknown>;
  if (
    !d ||
    ["quote", "note", "nextAction"].some(
      (k) =>
        typeof d[k] !== "string" ||
        !(d[k] as string).trim() ||
        (d[k] as string).length > 600,
    )
  )
    throw Error("invalid_output");
  if (!answers.some((a) => a.includes(d.quote as string)))
    throw Error("ungrounded_output");
  return {
    quote: d.quote as string,
    note: (d.note as string).trim(),
    nextAction: (d.nextAction as string).trim(),
    source: "ai",
    createdAt: new Date().toISOString(),
  };
}
export function trainingOrigin(s: VoiceSession): TrainingOrigin {
  if (
    !s.context ||
    !s.review ||
    s.review.sourceKey !== reviewKey(s.context, s.turns)
  )
    throw Error("현재 대화를 먼저 복기해 주세요.");
  return {
    sessionId: s.id,
    sourceKey: s.review.sourceKey,
    quote: s.review.improvement.quote,
    focus: s.review.focus,
  };
}
export function suggestTraining(focus: string): TrainingSkill {
  if (/질문|확인|경청|듣|단서/.test(focus)) return "followup";
  if (/소재|연상|취향|스몰토크|말문/.test(focus)) return "associate";
  return "clarity";
}
export function trainingReplay(
  origin: TrainingOrigin,
  source: VoiceSession | undefined,
): VoiceSession {
  if (!source)
    throw Error(
      "원래 대화가 삭제되어 재연습을 열 수 없어요. 훈련 기록은 그대로 남아요.",
    );
  if (!source.review || source.review.sourceKey !== origin.sourceKey)
    throw Error(
      "원래 대화의 복기가 달라졌어요. 최신 복기에서 다시 시작해 주세요.",
    );
  return reviewDrill(source, source.review);
}
