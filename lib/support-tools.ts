// One vocabulary for the More menu, destination headings, and breadcrumbs.
export const supportTools = [
  {
    id: "messenger",
    icon: "send",
    label: "메시지 답장",
    description: "받은 메시지에 답할 문장 준비",
  },
  {
    id: "terms",
    icon: "book",
    label: "용어 노트",
    description: "업종별 표현 · 나만의 뜻과 메모",
  },
  {
    id: "room",
    icon: "chat",
    label: "AI 대화 상대",
    description: "상대 만들기 · 역할 연습 · 자유 대화",
  },
  {
    id: "guide",
    icon: "help",
    label: "사용·저장 안내",
    description: "첫 사용 가이드 · 저장 위치 · 내보내기",
  },
] as const;
export function supportLabel(id: (typeof supportTools)[number]["id"]) {
  return supportTools.find((tool) => tool.id === id)!.label;
}
