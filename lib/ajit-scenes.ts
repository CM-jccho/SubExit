import type { ConversationCard, ContextProfile } from "./conversation-cards";
import type { VoiceSession } from "./voice-notebook";

export type AjitSceneId = "request" | "boundary" | "response";
export type SceneStamp = {
  sourceSessionId: string;
  replaySessionId: string;
  completedAt: string;
};
export type AjitScene = {
  id: AjitSceneId;
  label: string;
  souvenir: string;
  guide: "dundi" | "coco";
  invitation: string;
  context: ContextProfile;
  challenge: string;
};
export const ajitScenes: AjitScene[] = [
  {
    id: "request",
    label: "부탁하기",
    souvenir: "마주 앉는 테이블",
    guide: "dundi",
    invitation: "제가 바쁜 동료 역할을 할게요. 부담 주지 않고 부탁해 볼까요?",
    context: {
      title: "동료에게 검토 부탁하기",
      myRole: "제안서를 준비하는 담당자",
      partner: "자기 업무로 바쁜 동료",
      situation: "고객에게 보낼 제안서를 동료에게 검토받고 싶다.",
      goal: "검토할 부분과 가능한 시간을 정중하게 부탁하기",
      boundaries: "당연히 도와줄 거라고 여기거나 즉시 답변을 재촉하지 않기",
      tone: "firm_polite",
    },
    challenge:
      "동료가 오늘은 시간이 전혀 없다고 한 차례 거절한다. 부담을 주지 않고 다른 시간이나 더 작은 도움을 제안해 본다.",
  },
  {
    id: "boundary",
    label: "거절하기",
    souvenir: "내가 지킬 선 메모보드",
    guide: "coco",
    invitation:
      "급한 부탁을 하는 동료가 되어볼게요. 할 수 있는 범위를 말해보세요.",
    context: {
      title: "갑작스러운 추가 업무에 정중히 선 긋기",
      myRole: "오늘 마감할 업무가 있는 담당자",
      partner: "자신의 업무도 오늘 대신 끝내 달라는 동료",
      situation:
        "가상 장면: 내 업무 마감이 임박했는데 동료가 자신의 자료 정리까지 오늘 해 달라고 부탁한다.",
      goal: "오늘 맡기 어려운 범위를 분명히 말하고 가능한 대안을 제안하기",
      boundaries: "무조건 수락하거나 상대를 탓하지 않기",
      tone: "firm_polite",
    },
    challenge:
      "동료가 지난번에 도와줬던 일을 언급하며 한 번 더 부탁한다. 고마움은 표현하되 오늘 가능한 범위를 유지한다.",
  },
  {
    id: "response",
    label: "어려운 응대",
    souvenir: "잠깐 확인하는 카운터 벨",
    guide: "coco",
    invitation:
      "환불을 재촉하는 손님 역할을 할게요. 확인할 것부터 차근차근 말해봐요.",
    context: {
      title: "규정 밖 환불·추가 보상 요구에 대응하기",
      myRole: "매장 아르바이트생",
      partner: "환불과 추가 보상을 즉시 요구하는 고객",
      situation:
        "가상 장면: 고객이 주문 불만을 말하며 직원 권한 밖의 환불과 추가 보상을 요구한다. 환불 가능 여부는 아직 확인되지 않았다.",
      goal: "불편을 확인하고 권한 밖의 보상은 약속하지 않은 채 확인 절차와 책임자 연결을 안내하기",
      boundaries: "확인하지 않은 환불 규정이나 보상을 단정하지 않기",
      tone: "firm_polite",
    },
    challenge:
      "손님이 바로 답을 달라고 한 차례 재촉한다. 모르는 규정을 만들어 말하지 않고 확인 절차와 책임자 연결 가능 여부를 설명한다.",
  },
];
export function ajitCard(
  scene: AjitScene,
  challenge = false,
): ConversationCard {
  const now = new Date().toISOString();
  return {
    ...scene.context,
    situation:
      scene.context.situation + (challenge ? " " + scene.challenge : ""),
    id: `card-ajit-${scene.id}${challenge ? "-challenge" : ""}`,
    companion: scene.guide,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    useCount: 0,
    source: "manual",
  };
}
// Classify only our explicit scene templates, never arbitrary conversation text.
export function sceneForSession(session: VoiceSession): AjitScene | undefined {
  return ajitScenes.find(
    (s) =>
      s.context.title === session.context?.title &&
      s.context.goal === session.context.goal,
  );
}
export function conversationRoot(s: VoiceSession) {
  return s.gardenRootId || s.practicePlan?.sourceSessionId || s.id;
}
