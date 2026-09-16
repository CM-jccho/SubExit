export type PromptCheck = {
  id: string;
  label: string;
  found: boolean;
  evidence: string;
};
export type PromptVersion = {
  model?: string;
  id: string;
  prompt: string;
  output: string;
  source: "ai" | "sample";
  createdAt: string;
  checks: PromptCheck[];
};
export const promptTasks = [
  {
    id: "meeting",
    title: "회의록 정리",
    description: "담당자와 미정인 일을 구분해요",
    initial: "회의록 정리해줘.",
    facts:
      "가상 회의 메모: 모아는 금요일까지 로그인 화면 초안을 만든다. 토리는 수요일까지 오류 재현 결과를 공유한다. 출시 날짜는 정하지 않았다. 추가 채용은 논의만 했고 결정하지 않았다.",
    conditions: [
      "담당자·할 일·기한을 표로 정리해 주세요.",
      "확정된 일과 미정인 일을 나눠 주세요.",
      "자료에 없는 날짜나 결정을 만들지 말아 주세요.",
    ],
    checks: [
      {
        id: "owners",
        label: "담당자 두 명",
        pattern: "모아[\\s\\S]*토리|토리[\\s\\S]*모아",
      },
      {
        id: "deadlines",
        label: "수요일·금요일 기한",
        pattern: "수요일[\\s\\S]*금요일|금요일[\\s\\S]*수요일",
      },
      {
        id: "unknown",
        label: "미정·미결정 표시",
        pattern: "미정|정하지|결정하지|미결정|결정되지",
      },
    ],
    sampleBefore:
      "로그인 화면 초안과 오류 재현 결과를 준비하기로 했습니다. 출시 날짜와 추가 채용은 추후 논의할 예정입니다.",
    sampleAfter:
      "확정된 일\n| 담당자 | 할 일 | 기한 |\n| 모아 | 로그인 화면 초안 | 금요일 |\n| 토리 | 오류 재현 결과 공유 | 수요일 |\n\n미정인 일\n- 출시 날짜: 미정\n- 추가 채용: 논의만 했으며 결정하지 않음",
  },
  {
    id: "reply",
    title: "고객 응대문 작성",
    description: "공감하면서 약속의 범위를 지켜요",
    initial: "고객에게 답장 써줘.",
    facts:
      "가상 고객 문의: 배송이 하루 늦었다며 환불과 추가 보상을 요구한다. 주문번호는 아직 전달받지 못했다. 내부 안내: 주문번호 확인 후 담당자가 환불 가능 여부를 검토한다. 이 상담원은 환불 승인이나 추가 보상을 약속할 권한이 없다. 처리 완료 시점은 아직 알 수 없다.",
    conditions: [
      "불편에 공감하고 주문번호를 요청해 주세요.",
      "환불·보상·완료 시점을 확정해서 약속하지 말아 주세요.",
      "확인 절차와 다음 행동을 3문장 이내로 안내해 주세요.",
    ],
    checks: [
      { id: "order", label: "주문번호 요청", pattern: "주문번호" },
      {
        id: "process",
        label: "담당자 또는 확인 절차",
        pattern: "담당자|확인.*후|검토",
      },
      {
        id: "boundary",
        label: "확답 제한 표현",
        pattern:
          "확답.*어렵|확정.*어렵|약속.*어렵|확인.*필요|확정.*않|검토.*필요",
      },
    ],
    sampleBefore:
      "배송 지연으로 불편을 드려 죄송합니다. 문의 내용을 확인하고 안내드리겠습니다.",
    sampleAfter:
      "배송이 늦어 불편하셨겠습니다. 주문번호를 알려주시면 담당자가 환불 가능 여부를 검토하겠습니다. 추가 보상과 처리 완료 시점은 확인이 필요하여 지금 확답드리기 어렵습니다.",
  },
  {
    id: "proposal",
    title: "제안서 초안 요청",
    description: "독자·범위·근거를 함께 전달해요",
    initial: "이 서비스 제안서 써줘.",
    facts:
      "가상 서비스: 작은 매장의 예약 누락을 줄이는 예약 알림 도구. 제안 대상은 매장 점주. 가능한 기능은 예약 목록과 하루 전 알림이다. 가격과 도입 일정은 미정. 고객사 사례나 누락 감소율을 측정한 데이터는 없다. 첫 단계는 한 매장에서 2주간 시험 운영하며 누락 건수와 직원 확인 시간을 기록하는 것이다.",
    conditions: [
      "매장 점주가 이해할 수 있게 문제·해결·시험 운영 순서로 써 주세요.",
      "없는 고객 사례나 효과 수치, 가격을 만들지 말아 주세요.",
      "2주 시험 운영의 확인 지표와 미정 항목을 포함해 주세요.",
    ],
    checks: [
      { id: "pilot", label: "2주 시험 운영", pattern: "2주|두 주" },
      {
        id: "metrics",
        label: "누락·확인 시간 지표",
        pattern: "누락[\\s\\S]*확인 시간|확인 시간[\\s\\S]*누락",
      },
      {
        id: "unknown",
        label: "미정 항목 표시",
        pattern: "미정|확정되지|정해지지",
      },
    ],
    sampleBefore:
      "예약 알림 도구로 매장 예약을 관리해 보세요. 예약 목록과 하루 전 알림으로 직원이 예약을 확인할 수 있습니다.",
    sampleAfter:
      "문제: 매장 점주와 직원이 예약을 놓칠 수 있습니다.\n해결: 예약 목록과 하루 전 알림을 제공합니다.\n시험 운영: 한 매장에서 2주간 예약 누락 건수와 직원 확인 시간을 기록합니다. 효과 수치는 아직 검증되지 않았습니다.\n미정: 가격·도입 일정. 확인된 고객사 사례는 없습니다.",
  },
] as const;
export type PromptTask = (typeof promptTasks)[number];
export const findPromptTask = (id: string) =>
  promptTasks.find((t) => t.id === id);
export function inspectPromptOutput(
  task: PromptTask,
  output: string,
): PromptCheck[] {
  return task.checks.map((c) => {
    const found = new RegExp(c.pattern).exec(output);
    return {
      id: c.id,
      label: c.label,
      found: !!found,
      evidence: found ? found[0].slice(0, 240) : "",
    };
  });
}
export function promptVersion(
  task: PromptTask,
  prompt: string,
  output: string,
  source: "ai" | "sample",
): PromptVersion {
  return {
    id: "attempt-" + crypto.randomUUID(),
    prompt,
    output,
    source,
    checks: inspectPromptOutput(task, output),
    createdAt: new Date().toISOString(),
  };
}
