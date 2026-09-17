import { parseProfile, type ContextProfile } from "./conversation-cards";
import { RECORDING_MAX_TEXT, RECORDING_MAX_SEGMENTS } from "./recording-limits";
import {
  reviewKey,
  validateReview,
  type PracticeReview,
} from "./practice-review";
import type { VoiceSession, VoiceTurn } from "./voice-notebook";
export type RecordingSegment = {
  id: string;
  role: "user" | "assistant" | "unknown";
  text: string;
};
export type RecordingAnalysisDraft = {
  sourceTurnId: string;
  inputKey: string;
  transcript: string;
  segments: RecordingSegment[];
  context: ContextProfile;
  confirmed: boolean;
  review?: PracticeReview;
};
export function recordingInputKey(turn: VoiceTurn) {
  return JSON.stringify([
    turn.id,
    turn.text,
    turn.clip?.duration,
    turn.clip?.blob.size,
  ]);
}
export function splitRecordingTranscript(text: string): RecordingSegment[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => {
      const label = text.match(
        /^(나|내 말|상대|상대방|me|other|自分|相手)\s*[:：]\s*/i,
      );
      const role: RecordingSegment["role"] = !label
        ? "unknown"
        : /^(나|내 말|me|自分)$/i.test(label[1])
          ? "user"
          : "assistant";
      return {
        id: `segment-${i}`,
        text: label ? text.slice(label[0].length).trim() : text,
        role,
      };
    });
}
export function recordingTurns(segments: RecordingSegment[]): VoiceTurn[] {
  return segments.map((s) => ({
    id: s.id,
    text: s.text,
    role: s.role === "user" ? "user" : "assistant",
    terms: [],
    createdAt: "",
  }));
}
export function validateRecordingInput(value: unknown) {
  const d = value as {
    context: unknown;
    segments: RecordingSegment[];
    confirmed: boolean;
  };
  if (
    !d ||
    d.confirmed !== true ||
    !Array.isArray(d.segments) ||
    d.segments.length < 2 ||
    d.segments.length > RECORDING_MAX_SEGMENTS
  )
    throw new Error("화자 확인을 마친 2~600개 발화가 필요해요.");
  if (
    new Set(d.segments.map((s) => s?.id)).size !== d.segments.length ||
    d.segments.some(
      (s) =>
        !s ||
        typeof s.id !== "string" ||
        !/^segment-[a-zA-Z0-9-]{1,60}$/.test(s.id) ||
        !["user", "assistant"].includes(s.role) ||
        typeof s.text !== "string" ||
        !s.text.trim() ||
        s.text.length > 4000,
    ) ||
    d.segments.reduce((sum, s) => sum + s.text.length, 0) > RECORDING_MAX_TEXT
  )
    throw new Error(
      "모든 발화의 화자를 지정하고, 전체 문자는 60,000자, 발화 하나는 4,000자 이내로 확인해 주세요.",
    );
  if (
    !d.segments.some((s) => s.role === "user") ||
    !d.segments.some((s) => s.role === "assistant")
  )
    throw new Error(
      "내 말과 상대 말이 각각 한 번 이상 필요해요. 여러 사람이 나온 녹음은 한 상대와의 장면만 남겨 주세요.",
    );
  let context: ContextProfile;
  try {
    context = parseProfile(d.context);
  } catch {
    throw new Error(
      "상대·상황·원하는 결과를 입력하고, 기록 제목을 확인해 주세요.",
    );
  }
  const segments = d.segments.map((s) => ({
    id: s.id,
    role: s.role,
    text: s.text.trim(),
  }));
  return { context, segments, turns: recordingTurns(segments) };
}
export function recordingDrill(
  session: VoiceSession,
  draft: RecordingAnalysisDraft,
): VoiceSession {
  const source = session.turns.find((t) => t.id === draft.sourceTurnId);
  if (!source || recordingInputKey(source) !== draft.inputKey)
    throw new Error("원래 문자가 달라졌어요. 최신 문자를 다시 확인해 주세요.");
  const { context, turns } = validateRecordingInput(draft);
  if (!draft.review || draft.review.sourceKey !== reviewKey(context, turns))
    throw new Error("수정한 내용을 다시 코칭받아 주세요.");
  const at = turns.findIndex(
    (t) => t.id === draft.review!.improvement.turnId && t.role === "user",
  );
  const previous = turns.slice(0, at).findLast((t) => t.role === "assistant");
  if (!previous)
    throw new Error(
      "이 발화 앞에 상대의 말이 없어 바로 재연습할 수 없어요. 상대의 말이 있는 장면을 골라 주세요.",
    );
  const now = new Date().toISOString();
  return {
    id: "session-" + crypto.randomUUID(),
    title: context.title + " · 녹음에서 다시 연습",
    kind: "practice",
    context,
    industry: session.industry,
    companion: session.companion,
    languages: session.languages,
    turns: [
      {
        ...previous,
        origin: "recording",
        id: "turn-" + crypto.randomUUID(),
        createdAt: now,
      },
    ],
    practicePlan: {
      focus: draft.review.focus,
      sourceSessionId: session.id,
      carriedTurns: 1,
    },
    createdAt: now,
    updatedAt: now,
  };
}
const examples = [
  {
    id: "request",
    title: "동료에게 검토 부탁하기",
    partner: "업무가 바쁜 동료",
    situation: "고객 제안서의 요구사항 한 쪽 검토를 부탁하는 대화",
    goal: "검토 범위와 가능한 시간을 정중하게 합의하기",
    boundary: "바로 해줄 것이라고 가정하지 않기",
    text: [
      "어떤 부분을 봐드리면 될까요?",
      "요구사항 한 쪽만 검토해주실 수 있을까요?",
      "가능한 시간을 확인해볼게요.",
      "네, 오늘 바로 부탁드릴게요.",
    ],
    strength: "요구사항 한 쪽만",
    improvement: "오늘 바로 부탁드릴게요.",
    note: "상대가 아직 가능한 시간을 확인 중인데 오늘로 확정했어요.",
    rewrite: "가능한 시간을 알려주시면 제안서 일정과 맞춰볼게요.",
    focus: "범위를 정한 뒤 상대의 가능한 시간을 확인하기",
  },
  {
    id: "scope",
    title: "추가 수정 범위 조율하기",
    partner: "거래처 담당자",
    situation: "합의한 화면 외에 추가 수정을 요청받은 대화",
    goal: "추가 범위와 일정부터 확인하기",
    boundary: "검토 없이 무료 작업이나 납기를 약속하지 않기",
    text: [
      "다른 화면도 함께 바꿀 수 있나요?",
      "추가할 화면과 수정 범위를 먼저 확인할 수 있을까요?",
      "목록을 정리해서 보내드릴게요.",
      "네, 기존 일정 안에 모두 해드릴게요.",
    ],
    strength: "수정 범위를 먼저 확인",
    improvement: "기존 일정 안에 모두 해드릴게요.",
    note: "추가 목록을 받기 전에 완료 일정을 약속했어요.",
    rewrite: "목록을 확인한 뒤 가능한 일정과 추가 조건을 말씀드릴게요.",
    focus: "새 범위를 확인하기 전에는 기존 납기를 약속하지 않기",
  },
  {
    id: "family",
    title: "가족에게 낯선 표현 물어보기",
    partner: "새로운 노래를 좋아하는 가족",
    situation: "가족이 최애라는 표현을 써서 뜻을 물어보는 대화",
    goal: "모르는 표현의 뜻을 편하게 물어보기",
    boundary: "세대나 취향을 평가하지 않기",
    text: [
      "요즘 내 최애 노래야.",
      "최애가 어떤 뜻이야? 이 노래가 제일 좋다는 말이야?",
      "응, 요즘 가장 좋아하는 곡이라는 뜻이야.",
      "너희는 꼭 그런 말을 쓰더라.",
    ],
    strength: "어떤 뜻이야?",
    improvement: "너희는 꼭 그런 말을 쓰더라.",
    note: "표현을 이해한 뒤 세대 전체의 말투를 평가하는 문장으로 바뀌었어요.",
    rewrite: "그런 뜻이구나. 이 노래는 어떤 점이 좋아?",
    focus: "낯선 표현은 뜻을 확인하고 상대의 관심사로 이어가기",
  },
];
export const recordingExamples = examples.map((e) => {
  const context: ContextProfile = {
    title: e.title,
    myRole: "대화를 준비하는 나",
    partner: e.partner,
    situation: e.situation,
    goal: e.goal,
    boundaries: e.boundary,
    tone: "warm",
  };
  const segments: RecordingSegment[] = e.text.map((text, i) => ({
    id: `segment-example-${i}`,
    role: i % 2 ? "user" : "assistant",
    text,
  }));
  const raw = {
    strength: {
      turnId: segments[1].id,
      quote: e.strength,
      note: "질문의 범위를 구체적으로 말해 서로 확인할 수 있게 했어요.",
    },
    improvement: {
      turnId: segments[3].id,
      quote: e.improvement,
      note: e.note,
      rewrite: e.rewrite,
    },
    focus: e.focus,
  };
  return {
    id: e.id,
    title: e.title,
    context,
    segments,
    review: validateReview(raw, context, recordingTurns(segments)),
  };
});
